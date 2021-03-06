const testFixtureMaker = require('../src/testing/test-fixture-maker');
const errorFormatter = require('../src/testing/validation-error-formatter');

describe('Hashtable validation type', () => {
  const testFixture = testFixtureMaker.initFromSyncFunction('build/sync-functions/test-hashtable-sync-function.js');

  afterEach(() => {
    testFixture.resetTestEnvironment();
  });

  describe('size constraints', () => {
    describe('with static validation', () => {
      it('allows a hashtable that is within the minimum and maximum sizes', () => {
        const doc = {
          _id: 'hashtableDoc',
          staticSizeValidationProp: {
            foo: 1,
            bar: 2
          }
        };

        testFixture.verifyDocumentCreated(doc);
      });

      it('rejects a hashtable that is smaller than the minimum size', () => {
        const doc = {
          _id: 'hashtableDoc',
          staticSizeValidationProp: {
            foo: 1
          }
        };

        testFixture.verifyDocumentNotCreated(doc, 'hashtableDoc', errorFormatter.hashtableMinimumSizeViolation('staticSizeValidationProp', 2));
      });

      it('rejects a hashtable that is larger than the maximum size', () => {
        const doc = {
          _id: 'hashtableDoc',
          staticSizeValidationProp: {
            foo: 1,
            bar: 2,
            baz: 3
          }
        };

        testFixture.verifyDocumentNotCreated(doc, 'hashtableDoc', errorFormatter.hashtableMaximumSizeViolation('staticSizeValidationProp', 2));
      });
    });

    describe('with dynamic validation', () => {
      it('allows a hashtable that is within the minimum and maximum sizes', () => {
        const doc = {
          _id: 'hashtableDoc',
          dynamicSizeValidationProp: {
            foo: 1
          },
          dynamicSize: 1
        };

        testFixture.verifyDocumentCreated(doc);
      });

      it('rejects a hashtable that is smaller than the minimum size', () => {
        const doc = {
          _id: 'hashtableDoc',
          dynamicSizeValidationProp: {
            foo: 1
          },
          dynamicSize: 2
        };

        testFixture.verifyDocumentNotCreated(doc, 'hashtableDoc', errorFormatter.hashtableMinimumSizeViolation('dynamicSizeValidationProp', 2));
      });

      it('rejects a hashtable that is larger than the maximum size', () => {
        const doc = {
          _id: 'hashtableDoc',
          dynamicSizeValidationProp: {
            foo: 1,
            bar: 2
          },
          dynamicSize: 1
        };

        testFixture.verifyDocumentNotCreated(doc, 'hashtableDoc', errorFormatter.hashtableMaximumSizeViolation('dynamicSizeValidationProp', 1));
      });
    });
  });

  describe('non-empty key constraint', () => {
    describe('with static validation', () => {
      it('allows a doc with a key that is not empty', () => {
        const doc = {
          _id: 'hashtableDoc',
          staticNonEmptyKeyValidationProp: { 'foo': 'bar' }
        };

        testFixture.verifyDocumentCreated(doc);
      });

      it('blocks a doc with an empty key', () => {
        const doc = {
          _id: 'hashtableDoc',
          staticNonEmptyKeyValidationProp: { '': 'bar' }
        };

        testFixture.verifyDocumentNotCreated(doc, 'hashtableDoc', errorFormatter.hashtableKeyEmpty('staticNonEmptyKeyValidationProp'));
      });
    });

    describe('with dynamic validation', () => {
      it('allows a doc with a key that is not empty', () => {
        const doc = {
          _id: 'hashtableDoc',
          dynamicNonEmptyKeyValidationProp: { 'foo': 'bar' },
          dynamicKeysMustNotBeEmpty: true
        };

        testFixture.verifyDocumentCreated(doc);
      });

      it('allows a doc with an empty key when the constraint is disabled', () => {
        const doc = {
          _id: 'hashtableDoc',
          dynamicNonEmptyKeyValidationProp: { '': 'bar' },
          dynamicKeysMustNotBeEmpty: false
        };

        testFixture.verifyDocumentCreated(doc);
      });

      it('blocks a doc with an empty key when the constraint is enabled', () => {
        const doc = {
          _id: 'hashtableDoc',
          dynamicNonEmptyKeyValidationProp: { '': 'bar' },
          dynamicKeysMustNotBeEmpty: true
        };

        testFixture.verifyDocumentNotCreated(doc, 'hashtableDoc', errorFormatter.hashtableKeyEmpty('dynamicNonEmptyKeyValidationProp'));
      });
    });
  });

  describe('key regular expression pattern constraint', () => {
    describe('with static validation', () => {
      it('allows a doc when all keys match the expected pattern', () => {
        const doc = {
          _id: 'hashtableDoc',
          staticKeyRegexPatternValidationProp: {
            'Foo`bar': 'baz',
            'Baz': 'qux'
          }
        };

        testFixture.verifyDocumentCreated(doc);
      });

      it('blocks a doc when a key does not match the expected pattern', () => {
        const doc = {
          _id: 'hashtableDoc',
          staticKeyRegexPatternValidationProp: {
            '123': 'foo',
            'bar': 'baz'
          }
        };

        testFixture.verifyDocumentNotCreated(
          doc,
          'hashtableDoc',
          errorFormatter.regexPatternHashtableKeyViolation('staticKeyRegexPatternValidationProp[123]', /^[a-zA-Z]+(`[a-zA-Z]+)?$/));
      });
    });

    describe('with dynamic validation', () => {
      const testRegexPattern = '^\\d+$';

      it('allows a doc with a string that matches the expected pattern', () => {
        const doc = {
          _id: 'hashtableDoc',
          dynamicKeyRegexPatternValidationProp: {
            '1': 'foo',
            '2': 'bar'
          },
          dynamicKeyRegex: testRegexPattern
        };

        testFixture.verifyDocumentCreated(doc);
      });

      it('blocks a doc with a string that does not match the expected pattern', () => {
        const doc = {
          _id: 'hashtableDoc',
          dynamicKeyRegexPatternValidationProp: {
            '1': 'foo',
            'bar': 'baz'
          },
          dynamicKeyRegex: testRegexPattern
        };

        testFixture.verifyDocumentNotCreated(
          doc,
          'hashtableDoc',
          errorFormatter.regexPatternHashtableKeyViolation('dynamicKeyRegexPatternValidationProp[bar]', new RegExp(testRegexPattern)));
      });
    });
  });

  describe('dynamic keys validator', () => {
    it('allows a hashtable with only non-empty keys', () => {
      const doc = {
        _id: 'hashtableDoc',

        // Each key must be a non-empty string when there is more than one item in the hashtable
        dynamicKeysValidatorProp: {
          'a': 'foo',
          'b': 'bar'
        }
      };

      testFixture.verifyDocumentCreated(doc);
    });

    it('allows a hashtable with an empty key when that option is enabled', () => {
      const doc = {
        _id: 'hashtableDoc',

        // A key may be an empty string when there is only a single item in the hashtable
        dynamicKeysValidatorProp: { '': 'foo' }
      };

      testFixture.verifyDocumentCreated(doc);
    });

    it('blocks a hashtable with an empty key when that option is disabled', () => {
      const doc = {
        _id: 'hashtableDoc',

        // Each key must be a non-empty string when there is more than one item in the hashtable
        dynamicKeysValidatorProp: {
          'a': 'foo',
          '': 'bar'
        }
      };

      testFixture.verifyDocumentNotCreated(doc, 'hashtableDoc', errorFormatter.hashtableKeyEmpty('dynamicKeysValidatorProp'));
    });
  });

  describe('hashtable values validator', () => {
    describe('with static validation', () => {
      it('allows a hashtable with valid element values', () => {
        const doc = {
          _id: 'hashtableDoc',
          staticValuesValidatorProp: {
            '1': 'foo',
            '2': 'bar',
            '3': 'baz'
          }
        };

        testFixture.verifyDocumentCreated(doc);
      });

      it('rejects a hashtable with invalid element values', () => {
        const doc = {
          _id: 'hashtableDoc',
          staticValuesValidatorProp: {
            '1': 'foo',
            '2': '',
            '3': null,
            '4': void 0,
            '5': 13
          }
        };

        testFixture.verifyDocumentNotCreated(
          doc,
          'hashtableDoc',
          [
            errorFormatter.mustNotBeEmptyViolation('staticValuesValidatorProp[2]'),
            errorFormatter.requiredValueViolation('staticValuesValidatorProp[3]'),
            errorFormatter.requiredValueViolation('staticValuesValidatorProp[4]'),
            errorFormatter.typeConstraintViolation('staticValuesValidatorProp[5]', 'string')
          ]);
      });
    });

    describe('with dynamic validation', () => {
      it('allows a hashtable with valid element values', () => {
        const doc = {
          _id: 'hashtableDoc',
          dynamicValuesValidatorProp: {
            '1': 'foo',
            '2': 'bar',
            '3': 'baz'
          },
          dynamicValuesType: 'string'
        };

        testFixture.verifyDocumentCreated(doc);
      });

      it('rejects a hashtable with invalid element values', () => {
        const doc = {
          _id: 'hashtableDoc',
          dynamicValuesValidatorProp: {
            '1': 1.93,
            '2': 'foo'
          },
          dynamicValuesType: 'float'
        };

        testFixture.verifyDocumentNotCreated(
          doc,
          'hashtableDoc',
          [ errorFormatter.typeConstraintViolation('dynamicValuesValidatorProp[2]', 'float') ]);
      });
    });
  });
});
