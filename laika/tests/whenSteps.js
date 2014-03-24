addATodoItem = function addATodoItem(todoTitle, todoDetails, where) {
	return where.eval(function(todoTitle, todoDetails) {
		var id = Todos.insertOne({
			title: todoTitle,
			details: todoDetails
		});
		Meteor.tx.commit();
		emit('added', id);
	}, todoTitle, todoDetails);
};

removeATodoItem = function removeATodoItem(mongoId, where) {
	return where.eval(function(mongoId) {
		Todos.removeOne(mongoId);
		Meteor.tx.commit();
	}, mongoId);
};

removeAnExistingTodoItem = function removeAnExistingTodoItem(todoTitle, todoDetails, where) {
	addATodoItem(todoTitle, todoDetails, where).once('added', function(id) {
		removeATodoItem(id, where);
	});
};