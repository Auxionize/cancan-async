'use strict';

/**
 * Dependencies
 */

const cancan = require('./');

const authorize = cancan.authorize;
const cannot = cancan.cannot;
const can = cancan.can;

const chai = require('chai');
chai.use(require('chai-as-promised'));

require('co-mocha');

chai.should();


/**
 * Example classes
 */

class Entity {
	constructor(attrs) {
		this.attrs = attrs || {};
	}

	get(key) {
		return this.attrs[key];
	}
}

class User extends Entity {
}

class Product extends Entity {
}


/**
 * Tests
 */

describe('cancan', function () {
	beforeEach(function () {
		cancan.reset();
	});

	it('allow one action', function* () {

		cancan.configure(User, function (user) {
			this.can('read', Product);
		});

		let user = new User();
		let product = new Product();

		(yield can(user, 'read', product)).should.equal(true);
		(yield cannot(user, 'read', product)).should.equal(false);
		(yield can(user, 'create', product)).should.equal(false);
	});

	it('allow many actions', function* () {
		cancan.configure(User, function (user) {
			this.can(['read', 'create', 'destroy'], Product);
		});

		let user = new User();
		let product = new Product();

		(yield can(user, 'read', product)).should.equal(true);
		(yield can(user, 'create', product)).should.equal(true);
		(yield can(user, 'destroy', product)).should.equal(true);
	});

	it('allow all actions using "manage"', function* () {
		cancan.configure(User, function (user) {
			this.can('manage', Product);
		});

		let user = new User();
		let product = new Product();

		(yield can(user, 'read', product)).should.equal(true);
		(yield can(user, 'create', product)).should.equal(true);
		(yield can(user, 'update', product)).should.equal(true);
		(yield can(user, 'destroy', product)).should.equal(true);
		(yield can(user, 'modify', product)).should.equal(true);
	});

	it('allow all actions and all objects', function* () {
		cancan.configure(User, function (user) {
			this.can('manage', 'all');
		});

		let user = new User();
		let product = new Product();

		(yield can(user, 'read', user)).should.equal(true);
		(yield can(user, 'read', product)).should.equal(true);
	});

	it('allow only certain items', function* () {
		cancan.reset().configure(User, function (user) {
			this.can('read', Product, {published: true});
		});

		let user = new User();
		let privateProduct = new Product();
		let publicProduct = new Product({published: true});

		(yield can(user, 'read', privateProduct)).should.equal(false, 'A private product is readable');
		(yield can(user, 'read', publicProduct)).should.equal(true, 'A public product is not readable');
	});

	it('allow only certain items via validator function', function* () {
		cancan.configure(User, function (user) {
			this.can('read', Product, function* (product) {
				return product.get('published') === true;
			});
		});

		let user = new User();
		let privateProduct = new Product();
		let publicProduct = new Product({published: true});

		(yield can(user, 'read', privateProduct)).should.equal(false, 'A private product is readable');
		(yield can(user, 'read', publicProduct)).should.equal(true, 'A public product is not readable');
	});

	it('allow only certain items via asyncronous validator function', function* () {
		cancan.configure(User, function (user) {
			this.can('read', Product, function* (product) {
				let isPublic = new Promise(function (resolve) {
					resolve(product.get('published'))
				});

				return (yield isPublic) === true;
			});
		});

		let user = new User();
		let privateProduct = new Product();
		let publicProduct = new Product({published: true});

		(yield can(user, 'read', privateProduct)).should.equal(false, 'A private product is readable');
		(yield can(user, 'read', publicProduct)).should.equal(true, 'A public product is not readable');
	});

	it('allow many arguments to validator function', function* () {
		cancan.configure(User, function (user) {
			this.can('read', Product, function* (product, subProduct) {
				return product.get('published') === true && subProduct.isViewable === 'yes';
			});
		});

		let user = new User();
		let product = new Product({published: true});

		(yield can(user, 'read', product, { isViewable: 'yes' })).should.equal(true);
		(yield can(user, 'read', product, { isViewable: 'no' })).should.equal(false);
	});

	it('throw an exception', function* () {
		cancan.configure(User, function (user) {
			this.can('read', Product, function* (product) {
				return product.get('published') === true;
			});
		});

		let user = new User();
		let privateProduct = new Product();
		let publicProduct = new Product({published: true});

		yield authorize(user, 'read', publicProduct);

		try {
			yield authorize(user, 'read', privateProduct);
		} catch (e) {
			e.status.should.equal(401);
			return;
		}

		throw new Error('Exception was not fired');
	});

	it('validator function may return non-boolean value', function* () {
		let message = "The product is not published yet!";

		cancan.configure(User, function (user) {
			this.can('read', Product, function* (product) {
				return product.get('published') === true ? true : message;
			});
			this.can('write', Product, function* (product) {
				return product.get('published') === true ? true : false;
			});
		});

		let user = new User();
		let privateProduct = new Product({published: false});
		let publicProduct = new Product({published: true});

		(yield can(user, 'read', privateProduct)).should.equal(message, 'A private product is readable');
		(yield can(user, 'read', publicProduct)).should.equal(true, 'A public product is not readable');
	});

	it('authorize() exception contains return value of last failed validator function', function* () {
		let message = "The product is not published yet!";

		cancan.configure(User, function (user) {
			this.addRule('read', Product, function* (product) {
				return product.get('published') === true ? true : message;
			});
		});
		cancan.configure(User, function (user) {
			this.addRule('write', Product, function* (product) {
				return product.get('published') === true ? true : false;
			});

			this.addRule('login', User, function* (user) {
				return user.get('banned') === false;
			});
		});

		let user = new User();
		let privateProduct = new Product({published: false});
		let thrown = false;

		try {
			yield authorize(user, 'read', privateProduct);
		} catch (e) {
			e.status.should.equal(401);
			e.result.should.equal(message);
			thrown = true;
		}

		thrown.should.equal(true);
	});
});
