(function() {
	var OriginalCollection,
		__hasProp = {}.hasOwnProperty,
		__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

	OriginalCollection = Meteor.Collection;

	Meteor.Collection = (function(_super) {

		__extends(Collection, _super);

		Collection.prototype._versioned = false;

		function Collection(name, options) {
			var _this = this;
			if (options == null) {
				options = {};
			}
			Collection.__super__.constructor.call(this, name, options);
			this._versioned = options.versioned != null ? options.versioned : false;
			if (!this._versioned) {
				return this;
			}
			this._defineOperations();
			this._crdts = new Meteor.Collection("_" + name + "Crdts");
			if (Meteor.isServer) {
				this._crdts._ensureIndex({
					crdtId: 1
				});
			}
			this._propSpec = options.props != null ? options.props : {};
			_.each(['insert', 'update', 'remove', 'allow', 'deny'], function(method) {
				_this["_" + method] = _this[method];
				return delete _this[method];
			});
			this._tx = Meteor.tx;
			this._tx._addCollection(this);
			this._crdts.find().observe({
				removed: function(old) {
					return Meteor.tx._purgeUndoRedo();
				}
			});
		}

		Collection.prototype.insertOne = function(object) {
			var id;
			if (object._id != null) {
				id = object._id;
				delete object._id;
			} else {
				id = this._makeNewID();
			}
			this._tx._addOperation({
				op: 'insertObject',
				collection: this._name,
				crdtId: id,
				args: {
					object: object,
					id: this._makeNewID()
				}
			});
			return id;
		};

		Collection.prototype.removeOne = function(id) {
			this._tx._addOperation({
				op: 'removeObject',
				collection: this._name,
				crdtId: id
			});
			return id;
		};

		Collection.prototype.setProperty = function(id, key, value) {
			this._tx._addOperation({
				op: 'insertProperty',
				collection: this._name,
				crdtId: id,
				args: {
					key: key,
					value: value
				}
			});
			return id;
		};

		Collection.prototype.unsetProperty = function(id, key, locator) {
			var args;
			if (locator == null) {
				locator = null;
			}
			args = {
				key: key
			};
			if (locator != null) {
				args.locator = locator;
			}
			this._tx._addOperation({
				op: 'removeProperty',
				collection: this._name,
				crdtId: id,
				args: args
			});
			return id;
		};

		Collection.prototype.reset = function() {
			this.remove({});
			if (this._versioned) {
				this._crdts.remove({});
			}
			return true;
		};

		Collection.prototype._getCrdt = function(crdtId) {
			var serializedCrdt;
			serializedCrdt = this._crdts.findOne({
				_crdtId: crdtId
			});
			if (serializedCrdt != null) {
				return new Meteor._CrdtDocument(this._propSpec, serializedCrdt);
			} else {
				return void 0;
			}
		};

		Collection.prototype._getCurrentIndex = function(crdt, key) {
			var idxs;
			idxs = Meteor._ensure(this._propertyIdxs, crdt.id);
			if (idxs[key] == null) {
				idxs[key] = crdt.getNextIndex(key);
			}
			return idxs[key];
		};

		Collection.prototype._txRunning = function() {
			return this._updatedCrdts != null;
		};

		Collection.prototype._txStart = function() {
			console.assert(!this._txRunning(), 'Trying to start an already running transaction.');
			this._updatedCrdts = [];
			this._propertyIdxs = {};
			return true;
		};

		Collection.prototype._txCommit = function() {
			var crdt, crdtId, mongoId, newSnapshot, oldSnapshot, serializedCrdt, _i, _len, _ref;
			console.assert(this._txRunning(), 'Trying to commit a non-existent transaction.');
			_ref = this._updatedCrdts;
			for (_i = 0, _len = _ref.length; _i < _len; _i++) {
				mongoId = _ref[_i];
				serializedCrdt = this._crdts.findOne({
					_id: mongoId
				});
				console.assert(serializedCrdt != null);
				crdt = new Meteor._CrdtDocument(this._propSpec, serializedCrdt);
				crdtId = crdt.crdtId;
				newSnapshot = crdt.snapshot();
				oldSnapshot = this.findOne({
					_id: crdtId
				});
				if ((newSnapshot != null) && !(oldSnapshot != null)) {
					this._insert(newSnapshot);
				}
				if ((newSnapshot != null) && (oldSnapshot != null)) {
					this._update({
						_id: crdtId
					}, newSnapshot);
				}
				if ((oldSnapshot != null) && !(newSnapshot != null)) {
					this._remove({
						_id: crdtId
					});
				}
			}
			this._updatedCrdts = void 0;
			return true;
		};

		Collection.prototype._txAbort = function() {
			return this._updatedCrdts = void 0;
		};

		Collection.prototype._defineOperations = function() {
			var _this = this;
			return this._ops = {
				insertObject: function(crdtId, args, clock, site) {
					var crdt, entry, index, key, mongoId, serializedCrdt, value, _i, _len, _ref;
					console.assert(_this._txRunning(), 'Trying to execute operation "insertObject" outside a transaction.');
					crdt = _this._getCrdt(crdtId);
					if (crdt != null) {
						if (!crdt.deleted) {
							Meteor.log["throw"]('crdt.tryingToUndeleteVisibleCrdt', {
								collection: _this._name,
								crdtId: crdtId
							});
						}
						_this._crdts.update({
							_id: crdt.id
						}, {
							$set: {
								_deleted: false,
								_clock: clock
							}
						});
						mongoId = crdt.id;
					} else {
						crdt = new Meteor._CrdtDocument(_this._propSpec);
						crdt.id = args.id;
						crdt.crdtId = crdtId;
						crdt.clock = clock;
						_ref = args.object;
						for (key in _ref) {
							value = _ref[key];
							index = _this._getCurrentIndex(crdt, key);
							if (_.isArray(value)) {
								for (_i = 0, _len = value.length; _i < _len; _i++) {
									entry = value[_i];
									crdt.insertAtIndex(key, entry, index, site);
								}
							} else {
								crdt.insertAtIndex(key, value, index, site);
							}
						}
						serializedCrdt = crdt.serialize();
						mongoId = _this._crdts.insert(serializedCrdt);
					}
					_this._updatedCrdts.push(mongoId);
					return crdtId;
				},
				removeObject: function(crdtId, args, clock, site) {
					var crdt;
					console.assert(_this._txRunning(), 'Trying to execute operation "removeObject" outside a transaction.');
					crdt = _this._getCrdt(crdtId);
					if (crdt == null) {
						Meteor.log["throw"]('crdt.tryingToDeleteNonexistentCrdt', {
							collection: _this._name,
							crdtId: crdtId
						});
					}
					if (crdt.deleted) {
						Meteor.log["throw"]('crdt.tryingToDeleteCrdtTwice', {
							collection: _this._name,
							crdtId: crdtId
						});
					}
					_this._crdts.update({
						_id: crdt.id
					}, {
						$set: {
							_deleted: true,
							_clock: clock
						}
					});
					_this._updatedCrdts.push(crdt.id);
					return crdtId;
				},
				insertProperty: function(crdtId, args, clock, site) {
					var changedProps, crdt, index, position;
					console.assert(_this._txRunning(), 'Trying to execute operation "insertProperty" outside a transaction.');
					crdt = _this._getCrdt(crdtId);
					if (crdt == null) {
						Meteor.log["throw"]('crdt.tryingToInsertValueIntoNonexistentCrdt', {
							key: args.key,
							collection: _this._name,
							crdtId: crdtId
						});
					}
					index = _this._getCurrentIndex(crdt, args.key);
					position = crdt.insertAtIndex(args.key, args.value, index, site);
					changedProps = {
						_clock: clock
					};
					changedProps[args.key] = crdt.serialize()[args.key];
					_this._crdts.update({
						_id: crdt.id
					}, {
						$set: changedProps
					});
					_this._updatedCrdts.push(crdt.id);
					return position;
				},
				removeProperty: function(crdtId, args, clock, site) {
					var changedProps, crdt, deletedIndices, locator;
					locator = null;
					if (args.locator != null) {
						locator = args.locator;
					}
					console.assert(_this._txRunning(), 'Trying to execute operation "removeProperty" outside a transaction.');
					crdt = _this._getCrdt(crdtId);
					if (crdt == null) {
						Meteor.log["throw"]('crdt.tryingToDeleteValueFromNonexistentCrdt', {
							key: args.key,
							locator: locator,
							collection: _this._name,
							crdtId: crdtId
						});
					}
					deletedIndices = crdt["delete"](args.key, locator);
					changedProps = {
						_clock: clock
					};
					changedProps[args.key] = crdt.serialize()[args.key];
					_this._crdts.update({
						_id: crdt.id
					}, {
						$set: changedProps
					});
					_this._updatedCrdts.push(crdt.id);
					return deletedIndices;
				},
				inverse: function(crdtId, args, clock, site) {
					var changedProps, crdt, deletedIndex, origArgs, origChange, origIndex, origOp, origResult, origSite, undeletedIndices;
					origOp = args.op, origArgs = args.args, origResult = args.result;
					switch (origOp) {
						case 'insertObject':
							return _this._ops.removeObject(crdtId, {}, clock, site);
						case 'removeObject':
							console.assert(_this._txRunning(), 'Trying to execute operation ' + '"inverse(removeObject)" outside a transaction.');
							crdt = _this._getCrdt(crdtId);
							if (crdt == null) {
								Meteor.log["throw"]('crdt.tryingToUndeleteNonexistentCrdt', {
									collection: _this._name,
									crdtId: crdtId
								});
							}
							if (!crdt.deleted) {
								Meteor.log.warning('crdt.tryingToUndeleteVisibleCrdt', {
									collection: _this._name,
									crdtId: crdtId
								});
							}
							_this._crdts.update({
								_id: crdt.id
							}, {
								$set: {
									_deleted: false,
									_clock: clock
								}
							});
							_this._updatedCrdts.push(crdt.id);
							return true;
						case 'insertProperty':
							console.assert(_this._txRunning(), 'Trying to execute operation ' + '"inverse(insertProperty)" outside a transaction.');
							crdt = _this._getCrdt(crdtId);
							if (crdt == null) {
								Meteor.log["throw"]('crdt.tryingToDeleteValueFromNonexistentCrdt', {
									key: origArgs.key,
									locator: origResult,
									collection: _this._name,
									crdtId: crdtId
								});
							}
							origIndex = origResult[0], origSite = origResult[1], origChange = origResult[2];
							deletedIndex = crdt.deleteIndex(origArgs.key, origIndex, origSite, origChange);
							changedProps = {
								_clock: clock
							};
							changedProps[origArgs.key] = crdt.serialize()[origArgs.key];
							_this._crdts.update({
								_id: crdt.id
							}, {
								$set: changedProps
							});
							_this._updatedCrdts.push(crdt.id);
							return deletedIndex;
						case 'removeProperty':
							console.assert(_this._txRunning(), 'Trying to execute operation ' + '"inverse(removeProperty)" outside a transaction.');
							crdt = _this._getCrdt(crdtId);
							if (crdt == null) {
								Meteor.log["throw"]('crdt.tryingToUndeleteValueFromNonexistentCrdt', {
									key: origArgs.key,
									locator: origResult[0],
									collection: _this._name,
									crdtId: crdtId
								});
							}
							undeletedIndices = (function() {
								var _i, _len, _ref, _results;
								_results = [];
								for (_i = 0, _len = origResult.length; _i < _len; _i++) {
									_ref = origResult[_i], origIndex = _ref[0], origSite = _ref[1], origChange = _ref[2];
									_results.push(crdt.undeleteIndex(origArgs.key, origIndex, origSite, origChange));
								}
								return _results;
							})();
							changedProps = {
								_clock: clock
							};
							changedProps[origArgs.key] = crdt.serialize()[origArgs.key];
							_this._crdts.update({
								_id: crdt.id
							}, {
								$set: changedProps
							});
							_this._updatedCrdts.push(crdt.id);
							return undeletedIndices;
						default:
							return Meteor.log["throw"]('crdt.cannotInvert', {
								op: origOp
							});
					}
				}
			};
		};

		return Collection;

	})(OriginalCollection);

	var getCrdtCollectionName = function (collectionName) {
		return "_" + collectionName + "Crdts";
	}

	var getCrdtRecordsetName = function (recordsetName) {
		return "_" + recordsetName + "Crdts";
	}

	Meteor.publishVersioned = function(recordsetName, publishFunction) {
		Meteor.publish(recordsetName, publishFunction);

		var crdtRecordsetName = getCrdtRecordsetName(recordsetName);
		Meteor.publish(crdtRecordsetName, function() {
			var self = this;
			var publishHandler = {
				added: function(collectionName, id, fields) {
					self.added(getCrdtCollectionName(collectionName), id, fields); // todo: nem jó change?
				},
				changed : function(collectionName, id, fields) {
					self.changed(getCrdtCollectionName(collectionName), id, fields);
				},
				removed: function(collectionName, id, fields) {
					self.removed(getCrdtCollectionName(collectionName), id, fields);
				},
				stop: function() {
					self.stop();
				},
				error: function() {
					self.error();
				}
			};
			var result = publishFunction.apply(publishHandler, arguments);
			var publishedCollectionName = result._getCollectionName();
			var crdtCollectionName = getCrdtCollectionName(publishedCollectionName);

			var collection = Meteor.tx._getCollection(publishedCollectionName);
			if(!collection)
				return;
			var crdtCollection = collection._crdts;

			result.observeChanges({
				added: function(id, fields) {
					var addedCrdt = crdtCollection.findOne({_crdtId: id});
					if(addedCrdt)
						self.added(crdtCollectionName, addedCrdt._id, addedCrdt);
				},
				changed: function(id, fields) {
					var changedCrdt = crdtCollection.findOne({_crdtId: id});
					if(changedCrdt)
						self.changed(crdtCollectionName, changedCrdt._id, changedCrdt);
				},
				removed: function(id) {
					var removedCrdt = crdtCollection.findOne({_crdtId: id});
					if(removedCrdt)
						self.removed(crdtCollectionName, removedCrdt._id, removedCrdt);
				}
			});
			self.ready();
		});
	};

	Meteor.subscribeVersioned = function(recordsetName) {
		Meteor.subscribe(recordsetName);
		Meteor.subscribe(getCrdtRecordsetName(recordsetName));
	};
}).call(this);
