observe = function observe(collectionName, where) {
	return where.eval(function(collectionName) {
		var collection = eval(collectionName);

		collection.find().observe({
			added: onAdded,
			changed: onChanged,
			removed: onRemoved
		});

		function onAdded(document) {
			emit('added', document);
		}
		function onChanged(newDocument, oldDocument) {
			emit('changed', {
				'new': newDocument,
				'old': oldDocument
			});
		}
		function onRemoved(oldDocument) {
			emit('removed', oldDocument);
		}
	}, collectionName);
}
