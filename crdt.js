(function() {

	Meteor._CrdtDocument = (function() {

		function _CrdtDocument(collProps, serializedCrdt) {
			this.collProps = collProps != null ? collProps : null;
			if (serializedCrdt == null) {
				serializedCrdt = null;
			}
			if (serializedCrdt != null) {
				this.id = serializedCrdt._id, this.crdtId = serializedCrdt._crdtId, this.clock = serializedCrdt._clock, this.deleted = serializedCrdt._deleted;
				this.properties = _.omit(serializedCrdt, '_id', '_crdtId', '_clock', '_deleted');
			} else {
				this.id = void 0;
				this.crdtId = void 0;
				this.clock = {};
				this.properties = {};
				this.deleted = false;
			}
		}

		_CrdtDocument.prototype.getNextIndex = function(key) {
			if (this.properties[key] != null) {
				return this.properties[key].length;
			} else {
				return 0;
			}
		};

		_CrdtDocument.prototype.getOrderedVisiblePayloads = function(key) {
			var change, changes, index, payload, payloads, site, sites, sortedSites, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref;
			if (!this.properties[key]) {
				return [];
			}
			payloads = [];
			_ref = this.properties[key];
			for (index = _i = 0, _len = _ref.length; _i < _len; index = ++_i) {
				sites = _ref[index];
				for (site in sites) {
					changes = sites[site];
					for (change = _j = 0, _len1 = changes.length; _j < _len1; change = ++_j) {
						payload = changes[change];
						_.extend(payload, {
							index: index,
							site: site,
							change: change
						});
					}
				}
				sortedSites = _.sortBy(sites, function(payload) {
					return payload.site;
				});
				for (_k = 0, _len2 = sortedSites.length; _k < _len2; _k++) {
					changes = sortedSites[_k];
					for (_l = 0, _len3 = changes.length; _l < _len3; _l++) {
						payload = changes[_l];
						if (!payload.deleted) {
							payloads.push(payload);
						}
					}
				}
			}
			return payloads;
		};

		_CrdtDocument.prototype.insertAtIndex = function(key, value, index, site) {
			var payload, property;
			payload = {
				deleted: false,
				value: value
			};
			if (this.properties[key] == null) {
				this.properties[key] = [];
			}
			property = this.properties[key];
			if (!(index === 0 || (property[index - 1] != null))) {
				Meteor.log["throw"]('crdt.tryingToInsertIndexOutOfOrder', {
					key: key,
					index: index,
					site: site
				});
			}
			if (property[index] == null) {
				property[index] = {};
			}
			if (property[index][site] == null) {
				property[index][site] = [];
			}
			property[index][site].push(payload);
			return [index, site, property[index][site].length - 1];
		};

		_CrdtDocument.prototype["delete"] = function(key, locator) {
			var delPl, payloads, _i, _len, _ref, _ref1, _results,
				_this = this;
			if (locator == null) {
				locator = null;
			}
			if (this.properties[key] == null) {
				return [];
			}
			payloads = this.getOrderedVisiblePayloads(key);
			if ((locator != null) && ((_ref = this.collProps[key]) != null ? _ref.type : void 0) === '[{}]') {
				payloads = _.filter(payloads, function(payload) {
					return payload.value[_this.collProps[key].locator] === locator;
				});
			}
			if ((locator != null) && ((_ref1 = this.collProps[key]) != null ? _ref1.type : void 0) === '[*]') {
				if (!((0 <= locator && locator < payloads.length))) {
					Meteor.log["throw"]('crdt.tryingToDeleteNonexistentKeyAtPos', {
						key: key,
						pos: locator,
						crdtId: this.crdtId
					});
				}
				delPl = payloads[locator];
				delPl.deleted = true;
				return [[delPl.index, delPl.site, delPl.change]];
			} else {
				if (payloads.length === 0) {
					Meteor.log.warning('crdt.tryingToDeleteNonexistentKey', {
						key: key,
						crdtId: this.crdtId
					});
				}
				_results = [];
				for (_i = 0, _len = payloads.length; _i < _len; _i++) {
					delPl = payloads[_i];
					delPl.deleted = true;
					_results.push([delPl.index, delPl.site, delPl.change]);
				}
				return _results;
			}
		};

		_CrdtDocument.prototype._setDeleted = function(key, index, site, change, deleted) {
			var payload, _ref, _ref1, _ref2;
			if (((_ref = this.properties[key]) != null ? (_ref1 = _ref[index]) != null ? (_ref2 = _ref1[site]) != null ? _ref2[change] : void 0 : void 0 : void 0) == null) {
				Meteor.log["throw"]('crdt.tryingToUnDeleteNonexistentIndex', {
					key: key,
					index: index,
					site: site,
					change: change
				});
			}
			payload = this.properties[key][index][site][change];
			if (payload.deleted === deleted) {
				Meteor.log.warning('crdt.tryingToUnDeleteIndexInVisibleEntry', {
					key: key,
					index: index,
					site: site,
					change: change
				});
			}
			payload.deleted = deleted;
			return [index, site, change];
		};

		_CrdtDocument.prototype.deleteIndex = function(key, index, site, change) {
			return this._setDeleted(key, index, site, change, true);
		};

		_CrdtDocument.prototype.undeleteIndex = function(key, index, site) {
			return this._setDeleted(key, index, site, change, false);
		};

		_CrdtDocument.prototype.serialize = function() {
			var serializedCrdt;
			serializedCrdt = this.properties;
			_.extend(serializedCrdt, {
				_id: this.id,
				_crdtId: this.crdtId,
				_clock: this.clock,
				_deleted: this.deleted
			});
			return serializedCrdt;
		};

		_CrdtDocument.prototype.snapshot = function() {
			var collKey, collSpec, key, payload, snapshot, subkey, value, _i, _len, _ref, _ref1, _ref2;
			if (this.deleted) {
				return null;
			} else {
				snapshot = {
					_id: this.crdtId,
					_clock: this.clock
				};
				for (key in this.properties) {
					_ref = this.getOrderedVisiblePayloads(key);
					for (_i = 0, _len = _ref.length; _i < _len; _i++) {
						payload = _ref[_i];
						value = payload.value;
						switch ((_ref1 = this.collProps[key]) != null ? _ref1.type : void 0) {
							case '[*]':
								if (snapshot[key] == null) {
									snapshot[key] = [];
								}
								snapshot[key].push(value);
								break;
							case '[{}]':
								if (snapshot[key] == null) {
									snapshot[key] = {};
								}
								subkey = value[this.collProps[key].locator];
								snapshot[key][subkey] = value;
								break;
							default:
								snapshot[key] = value;
						}
					}
				}
				_ref2 = this.collProps;
				for (collKey in _ref2) {
					collSpec = _ref2[collKey];
					if (collSpec.type === '[{}]' && snapshot[collKey]) {
						snapshot[collKey] = _.values(snapshot[collKey]);
					}
				}
				return snapshot;
			}
		};

		return _CrdtDocument;

	})();

}).call(this);
