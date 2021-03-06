(function() {

	Meteor._TransactionsManager = (function() {

		_TransactionsManager.prototype._collections = {};

		_TransactionsManager.prototype._currentOps = [];

		_TransactionsManager.prototype._pendingTxs = [];

		_TransactionsManager.prototype._undoStack = [];

		_TransactionsManager.prototype._redoStack = [];

		function _TransactionsManager() {
			var self, transactions;
			if (Meteor.isServer) {
				this._localSite = 'server';
			} else {
				this._localSite = 'client-' + Random.id();
			}
			if (Meteor.isServer) {
				transactions = new Meteor.Collection('transactions');
				this.purgeLog = function() {
					return transactions.remove({});
				};
			}
			self = this;
			Meteor.methods({
				_executeTx: function(tx) {
					if (!this.isSimulation) {
						tx._id = transactions.insert(tx);
					}
					return self._execute(tx);
				}
			});
		}

		_TransactionsManager.prototype._purgeUndoRedo = function() {
			this._undoStack = [];
			return this._redoStack = [];
		};

		_TransactionsManager.prototype._getTick = function(clock, site) {
			if (clock[site] == null) {
				clock[site] = 0;
			}
			return clock[site];
		};

		_TransactionsManager.prototype._happenedBefore = function(clock1, clock2) {
			var clockComponent1, clockComponent2, didHappenBefore, site, sites, _i, _len;
			sites = _.union(_.keys(clock1), _.keys(clock2));
			didHappenBefore = false;
			for (_i = 0, _len = sites.length; _i < _len; _i++) {
				site = sites[_i];
				clockComponent1 = this._getTick(clock1, site);
				clockComponent2 = this._getTick(clock2, site);
				if (clockComponent1 > clockComponent2) {
					return false;
				}
				if (clockComponent1 < clockComponent2) {
					didHappenBefore = true;
				}
			}
			return didHappenBefore;
		};

		_TransactionsManager.prototype._getTxId = function(tx) {
			if (tx._id != null) {
				return tx._id;
			} else {
				return 'simulated';
			}
		};

		_TransactionsManager.prototype._addCollection = function(collection) {
			return this._collections[collection._name] = collection;
		};

		_TransactionsManager.prototype._getCollection = function(collection) {
			return this._collections[collection];
		};

		_TransactionsManager.prototype._addOperation = function(operation) {
			return this._currentOps.push(operation);
		};

		_TransactionsManager.prototype._addPending = function(tx) {
			var baseClock, crdt, lastClock, op, opClock, outOfOrder, txId, txSite, _i, _len, _ref;
			txId = this._getTxId(tx);
			txSite = tx.initiatingSite;
			outOfOrder = false;
			_ref = tx.operations;
			for (_i = 0, _len = _ref.length; _i < _len; _i++) {
				op = _ref[_i];
				opClock = op.clock;
				baseClock = _.clone(opClock);
				baseClock[txSite] = (this._getTick(opClock, txSite)) - 1;
				console.assert(baseClock[txSite] >= 0);
				op.baseClock = baseClock;
				crdt = this._collections[op.collection]._getCrdt(op.crdtId);
				lastClock = crdt != null ? crdt.clock : {};
				if (this._happenedBefore(baseClock, lastClock)) {
					Meteor.log.error('transaction.receivedDuplicateTx', {
						site: txSite,
						tx: txId
					});
					return false;
				}
				if (this._happenedBefore(lastClock, baseClock)) {
					outOfOrder = true;
				}
			}
			if (outOfOrder) {
				Meteor.log.warning('transaction.arrivedOutOfOrder', {
					site: txSite,
					tx: txId
				});
			}
			return this._pendingTxs.push(tx);
		};

		_TransactionsManager.prototype._abort = function(tx, txColls) {
			var coll, name, txId, _results;
			txId = this._getTxId(tx);
			Meteor.log.warning('transaction.aborting', {
				tx: txId
			});
			_results = [];
			for (name in txColls) {
				coll = txColls[name];
				_results.push(coll._txAbort());
			}
			return _results;
		};

		_TransactionsManager.prototype._doTransaction = function(tx) {
			var args, coll, name, op, txColls, txId, txSite, _i, _len, _ref;
			txId = this._getTxId(tx);
			txSite = tx.initiatingSite;
			txColls = {};
			_ref = tx.operations;
			for (_i = 0, _len = _ref.length; _i < _len; _i++) {
				op = _ref[_i];
				try {
					coll = this._collections[op.collection];
					console.assert(coll != null);
					if (Meteor.isClient) {
						coll._collection.pauseObservers();
					}
					if (!txColls[coll._name]) {
						txColls[coll._name] = coll;
						coll._txStart();
					}
					args = op.args != null ? op.args : {};
					op.result = coll._ops[op.op](op.crdtId, args, op.clock, txSite);
				} catch (e) {
					Meteor.log.error('transaction.operationProducedError', {
						op: op.op,
						tx: txId,
						message: _.isString(e) ? e : e.message
					});
					this._abort(tx, txColls);
					return false;
				}
			}
			for (name in txColls) {
				coll = txColls[name];
				coll._txCommit();
				if (Meteor.isClient) {
					coll._collection.resumeObservers();
				}
			}
			return true;
		};

		_TransactionsManager.prototype._execute = function(tx) {
			var collection, crdt, executableTx, i, initiatingSite, lastClock, op, pendingTx, _i, _j, _len, _len1, _ref, _ref1;
			this._addPending(tx);
			while (true) {
				executableTx = null;
				_ref = this._pendingTxs;
				for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
					pendingTx = _ref[i];
					executableTx = pendingTx;
					_ref1 = pendingTx.operations;
					for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
						op = _ref1[_j];
						collection = this._collections[op.collection];
						crdt = collection._getCrdt(op.crdtId);
						lastClock = crdt != null ? crdt.clock : {};
						if (this._happenedBefore(lastClock, op.baseClock)) {
							executableTx = null;
							break;
						}
					}
					if (executableTx != null) {
						this._pendingTxs.splice(i, 1);
						break;
					}
				}
				if (executableTx == null) {
					return true;
				}
				initiatingSite = executableTx.initiatingSite;
				Meteor.log.info('transaction.nowExecuting', {
					site: initiatingSite,
					tx: this._getTxId(executableTx)
				});
				if (!this._doTransaction(executableTx)) {
					return false;
				}
				if (initiatingSite === this._localSite && !executableTx.isUndo) {
					this._undoStack.push(executableTx.operations);
				}
			}
		};

		_TransactionsManager.prototype._ticTac = function(clock) {
			if (clock == null) {
				clock = {};
			}
			clock[this._localSite] = (this._getTick(clock, this._localSite)) + 1;
			return clock;
		};

		_TransactionsManager.prototype._queueInternal = function(operations, isUndo) {
			var crdt, op, tx, _i, _len;
			if (isUndo == null) {
				isUndo = false;
			}
			for (_i = 0, _len = operations.length; _i < _len; _i++) {
				op = operations[_i];
				crdt = this._collections[op.collection]._getCrdt(op.crdtId);
				op.clock = this._ticTac(crdt != null ? crdt.clock : void 0);
			}
			tx = {
				initiatingSite: this._localSite,
				isUndo: isUndo,
				operations: operations
			};
			return Meteor.call('_executeTx', tx);
		};

		_TransactionsManager.prototype.commit = function() {
			this._redoStack = [];
			this._queueInternal(this._currentOps);
			return this._currentOps = [];
		};

		_TransactionsManager.prototype.rollback = function() {
			return this._currentOps = [];
		};

		_TransactionsManager.prototype.undo = function() {
			var originalOperation, undoOperations, undoTx, _i, _len, _ref;
			if (this._undoStack.length === 0) {
				Meteor.log.info('transaction.nothingToUndo');
				return;
			}
			undoTx = this._undoStack.pop();
			undoOperations = [];
			_ref = (undoTx.slice(0)).reverse();
			for (_i = 0, _len = _ref.length; _i < _len; _i++) {
				originalOperation = _ref[_i];
				undoOperations.push({
					op: 'inverse',
					collection: originalOperation.collection,
					crdtId: originalOperation.crdtId,
					args: {
						op: originalOperation.op,
						args: originalOperation.args,
						result: originalOperation.result
					}
				});
			}
			this._queueInternal(undoOperations, true);
			return this._redoStack.push(undoTx);
		};

		_TransactionsManager.prototype.redo = function() {
			var redoTx;
			if (this._redoStack.length === 0) {
				Meteor.log.info('transaction.nothingToRedo');
				return;
			}
			redoTx = this._redoStack.pop();
			return this._queueInternal(redoTx);
		};

		return _TransactionsManager;

	})();

	Meteor._TransactionsManager = new Meteor._TransactionsManager;

	Meteor.tx = Meteor._TransactionsManager;

}).call(this);
