var assert = require('assert');
require('./common');

describe('versioned-collection', function() {
	describe('#insertOne()', function() {
		it('notifies the server', function(done, server, client) {
			observe('Todos', server).once('added', function(todo) {
				assert.equal(todo.title, 'Some title');
				assert.equal(todo.details, 'Some details');
				done();
			});

			addATodoItem('Some title', 'Some details', client);
		});

		it('notifies other clients', function(done, server, c1, c2, c3) {
			observe('Todos', c2).once('added', function(todo) {
				assert.equal(todo.title, 'Some title');
				assert.equal(todo.details, 'Some details');
				done();
			});

			observe('Todos', c3).once('added', function(todo) {
				assert.equal(todo.title, 'Some title');
				assert.equal(todo.details, 'Some details');
				done();
			});

			addATodoItem('Some title', 'Some details', c1);
		});
	});

	describe('#removeOne()', function() {
		it('notifies the server', function(done, server, client) {
			observe('Todos', server).once('removed', function(todo) {
				assert.equal(todo.title, 'Some title');
				done();
			});

			removeAnExistingTodoItem('Some title', 'Some details', client);
		});

		it('notifies other clients', function(done, server, c1, c2, c3) {
			observe('Todos', c2).once('removed', function(todo) {
				assert.equal(todo.title, 'Some title');
				done();
			});

			observe('Todos', c3).once('removed', function(todo) {
				assert.equal(todo.title, 'Some title');
				done();
			});

			removeAnExistingTodoItem('Some title', 'Some details', c1);
		});
	});
});
