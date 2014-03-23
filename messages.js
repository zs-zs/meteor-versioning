(function() {

	Meteor.i18nMessages.transaction = {
		arrivedOutOfOrder: 'The transaction {{tx}} from site {{site}} arrived out of order.',
		nowExecuting: 'Now executing transaction {{tx}} from site {{site}}.',
		receivedDuplicateTx: 'Received duplicate transaction {{tx}} from site "{{site}}".',
		operationProducedError: 'The operation "{{op}}" in transaction {{tx}} produced an error: {{message}}',
		transactionAlreadyStarted: 'Trying to start a transaction while a transaction has already been started.',
		noTransactionStarted: 'Trying to stop a transaction while no transaction is running.',
		aborting: 'Aborting transaction {{tx}}.',
		nothingToUndo: 'Nothing to undo.',
		nothingToRedo: 'Nothing to redo.'
	};

	Meteor.i18nMessages.crdt = {
		tryingToInsertValueIntoNonexistentCrdt: 'Trying to insert value for key "{{key}}" into crdt "{{collection}}" with non-existent id {{crdtId}}.',
		tryingToDeleteNonexistentCrdt: 'Trying to delete the non-existent object with id {{crdtId}} from crdt "{{collection}}".',
		tryingToDeleteCrdtTwice: 'Trying to delete the already hidden object with id {{crdtId}} from crdt "{{collection}}".',
		tryingToDeleteValueFromNonexistentCrdt: 'Trying to delete the value "{{key}}[{{locator}}]" from a non-existent object with id {{crdtId}} in crdt "{{collection}}".',
		tryingToDeleteNonexistentKeyAtPos: 'Trying to delete the non-existent (or invisible) key "{{key}}" at position "{{pos}}" in crdt {{crdtId}}.',
		tryingToDeleteNonexistentKey: 'Trying to delete the non-existent (or invisible) key "{{key}}" of crdt {{crdtId}}.',
		cannotInvert: 'Cannot invert unknown operation {{op}}.',
		tryingToUndeleteNonexistentCrdt: 'Trying to undelete the non-existent object with id {{crdtId}} from crdt "{{collection}}".',
		tryingToUndeleteVisibleCrdt: 'Trying to undelete the already visible object with id {{crdtId}} from crdt "{{collection}}".',
		tryingToUnDeleteNonexistentIndex: 'Trying to (un)delete the non-existent index "{{key}}.{{index}}.{{site}}.{{change}}".',
		tryingToUnDeleteIndexInVisibleEntry: 'Trying to (un)delete the already (in)visible index "{{key}}.{{index}}.{{site}}.{{change}}".',
		tryingToUndeleteValueFromNonexistentCrdt: 'Trying to undelete the value "{{key}}[{{locator}}]" from a non-existent object with id {{crdtId}} in crdt "{{collection}}".',
		tryingToInsertIndexOutOfOrder: 'Trying to insert index out of order: {{key}}.{{index}}.{{site}}.'
	};

}).call(this);
