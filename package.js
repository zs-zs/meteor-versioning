Package.describe({
	summary: "Undo/redo, improved conflict resolution and transactions for Meteor collections."
});

Package.on_use(function (api, where) {
	where = where || ['client', 'server'];
	api.use(['underscore', 'logger', 'i18n', 'mongo-livedata', 'livedata', 'random'], where);
	api.add_files('lib/crdt.js', where);
	api.add_files('lib/versioned-collection.js', where);
	api.add_files('lib/transactions.js', where);
	api.add_files('lib/messages.js', where);
});
