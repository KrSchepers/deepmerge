var merge = require('../')
var test = require('tape')
var isMergeableObject = require('is-mergeable-object')

test('merging objects with own __proto__', function(t) {
	var user = {}
	var malicious = JSON.parse('{ "__proto__": { "admin": true } }')
	var mergedObject = merge(user, malicious)
	t.notOk(mergedObject.__proto__.admin, 'non-plain properties should not be merged')
	t.notOk(mergedObject.admin, 'the destination should have an unmodified prototype')
	t.end()
})

test('merging objects with plain and non-plain properties', function(t) {
	var plainSymbolKey = Symbol('plainSymbolKey')
	var parent = {
		parentKey: 'should be undefined'
	}
	
	var target = Object.create(parent)	
	target.plainKey = 'should be replaced'
	target[plainSymbolKey] = 'should also be replaced'
	
	var source = {
		parentKey: 'foo',
		plainKey: 'bar',
		newKey: 'baz',
		[plainSymbolKey]: 'qux'
	}
	
	var mergedObject = merge(target, source)
	t.equal(undefined, mergedObject.parentKey, 'inherited properties of target should be removed, not merged or ignored')
	t.equal('bar', mergedObject.plainKey, 'enumerable own properties of target should be merged')
	t.equal('baz', mergedObject.newKey, 'properties not yet on target should be merged')
	t.equal('qux', mergedObject[plainSymbolKey], 'enumerable own symbol properties of target should be merged')
	t.end()
})

// the following cases come from the thread here: https://github.com/TehShrike/deepmerge/pull/164
test('merging strings works with a custom string merge', function(t) {
	var target = { name: "Alexander" }
	var source = { name: "Hamilton" }
	function customMerge(key, options) {
		if (key === 'name') {
			return function(target, source, options) {
				return target[0] + '. ' + source.substring(0, 3)
			}
		} else {
			return merge
		}
	}

	function mergeable(target) {
		return isMergeableObject(target) || (typeof target === 'string' && target.length > 1)
	}

	t.equal('A. Ham', merge(target, source, { customMerge: customMerge, isMergeableObject: mergeable }).name)
	t.end()
})

test('merging objects with null prototype', function(t) {
	var target = Object.create(null)
	var source = Object.create(null)
	target.wheels = 4
	target.trunk = { toolbox: ['hammer'] }
	source.trunk = { toolbox: ['wrench'] }
	source.engine = 'v8'
	var expected = {
		wheels: 4,
		engine: 'v8',
		trunk: {
			toolbox: ['hammer', 'wrench' ]
		}
	}

	t.deepEqual(expected, merge(target, source))
	t.end()
})

function maliciousObject() {
	return JSON.parse('{ "__proto__": { "admin": true }, "safe": "yes" }')
}

function assertNotPoisoned(t, mergedObject, description) {
	t.equal(Object.getPrototypeOf(mergedObject), Object.prototype, description + ': prototype should be unmodified')
	t.notOk(mergedObject.admin, description + ': should not inherit attacker-controlled properties')
	t.notOk(Object.prototype.hasOwnProperty.call(mergedObject, '__proto__'), description + ': __proto__ should be dropped')
	t.equal(mergedObject.safe, 'yes', description + ': other properties should still be merged')
}

test('merging __proto__ into a null-prototype target', function(t) {
	assertNotPoisoned(t, merge(Object.create(null), maliciousObject()), 'null-prototype target')
	t.end()
})

test('merging __proto__ into null, undefined and primitive values', function(t) {
	assertNotPoisoned(t, merge({ session: null }, { session: maliciousObject() }).session, 'null placeholder')
	assertNotPoisoned(t, merge({ session: undefined }, { session: maliciousObject() }).session, 'undefined placeholder')
	assertNotPoisoned(t, merge({ session: 0 }, { session: maliciousObject() }).session, 'number placeholder')
	assertNotPoisoned(t, merge({ session: 'none' }, { session: maliciousObject() }).session, 'string placeholder')
	assertNotPoisoned(t, merge({ session: false }, { session: maliciousObject() }).session, 'false placeholder')
	assertNotPoisoned(t, merge({ session: '' }, { session: maliciousObject() }).session, 'empty string placeholder')
	assertNotPoisoned(t, merge({ a: { b: null } }, { a: { b: maliciousObject() } }).a.b, 'deeply nested null placeholder')
	assertNotPoisoned(t, merge(null, maliciousObject()), 'null target')
	assertNotPoisoned(t, merge(undefined, maliciousObject()), 'undefined target')
	t.end()
})

test('merging a target that has an own __proto__ property', function(t) {
	assertNotPoisoned(t, merge(maliciousObject(), { other: true }), 'own __proto__ on target')
	assertNotPoisoned(t, merge(maliciousObject(), maliciousObject()), 'own __proto__ on target and source')
	t.end()
})

test('merging __proto__ with clone: false', function(t) {
	assertNotPoisoned(t, merge(Object.create(null), maliciousObject(), { clone: false }), 'null-prototype target without cloning')
	assertNotPoisoned(t, merge(maliciousObject(), { other: true }, { clone: false }), 'own __proto__ on target without cloning')
	t.end()
})
