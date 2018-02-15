var testHelper = require('../src/testing/test-helper.js');
var errorFormatter = testHelper.validationErrorFormatter;

describe('UUID validation type:', function() {
  beforeEach(function() {
    testHelper.initSyncFunction('build/sync-functions/test-uuid-sync-function.js');
  });

  describe('format validation', function() {
    it('allows a valid UUID with lowercase letters', function() {
      var doc = {
        _id: 'my-doc',
        type: 'uuidDocType',
        formatValidationProp: '1511fba4-e039-42cc-9ac2-9f2fa29eecfc'
      };

      testHelper.verifyDocumentCreated(doc);
    });

    it('allows a valid UUID with uppercase letters', function() {
      var doc = {
        _id: 'my-doc',
        type: 'uuidDocType',
        formatValidationProp: 'DFF421EA-0AB2-45C9-989C-12C76E7282B8'
      };

      testHelper.verifyDocumentCreated(doc);
    });

    it('rejects a UUID with invalid characters', function() {
      var doc = {
        _id: 'my-doc',
        type: 'uuidDocType',
        formatValidationProp: 'g78d516e-cb95-4ef7-b593-2ee7ce375738'
      };

      testHelper.verifyDocumentNotCreated(doc, 'uuidDocType', [ errorFormatter.uuidFormatInvalid('formatValidationProp') ]);
    });

    it('rejects a UUID without hyphens', function() {
      var doc = {
        _id: 'my-doc',
        type: 'uuidDocType',
        formatValidationProp: '1511fba4e03942cc9ac29f2fa29eecfc'
      };

      testHelper.verifyDocumentNotCreated(doc, 'uuidDocType', [ errorFormatter.uuidFormatInvalid('formatValidationProp') ]);
    });

    it('rejects a UUID with too many characters', function() {
      var doc = {
        _id: 'my-doc',
        type: 'uuidDocType',
        formatValidationProp: '1511fba4-e039-42cc-9ac2-9f2fa29eecfc3'
      };

      testHelper.verifyDocumentNotCreated(doc, 'uuidDocType', [ errorFormatter.uuidFormatInvalid('formatValidationProp') ]);
    });

    it('rejects a UUID with too few characters', function() {
      var doc = {
        _id: 'my-doc',
        type: 'uuidDocType',
        formatValidationProp: '1511fba4-e03-42cc-9ac2-9f2fa29eecfc'
      };

      testHelper.verifyDocumentNotCreated(doc, 'uuidDocType', [ errorFormatter.uuidFormatInvalid('formatValidationProp') ]);
    });
  });

  describe('minimum and maximum value range constraints', function() {
    it('allows a UUID that falls within the minimum and maximum values', function() {
      var doc = {
        _id: 'my-doc',
        type: 'uuidDocType',
        rangeValidationProp: 'ABCDEF01-2345-6789-0ABC-DEF012345678'
      };

      testHelper.verifyDocumentCreated(doc);
    });

    it('rejects a UUID that is less than the minimum value', function() {
      var doc = {
        _id: 'my-doc',
        type: 'uuidDocType',
        rangeValidationProp: '9aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      };

      testHelper.verifyDocumentNotCreated(
        doc,
        'uuidDocType',
        [ errorFormatter.minimumValueViolation('rangeValidationProp', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') ]);
    });

    it('rejects a UUID that is greater than the minimum value', function() {
      var doc = {
        _id: 'my-doc',
        type: 'uuidDocType',
        rangeValidationProp: 'dddddddd-dddd-dddd-dddd-ddddddddddde'
      };

      testHelper.verifyDocumentNotCreated(
        doc,
        'uuidDocType',
        [ errorFormatter.maximumValueViolation('rangeValidationProp', 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD') ]);
    });
  });

  describe('intelligent equality constraint', function() {
    it('allows a UUID that matches the expected value exactly', function() {
      var doc = {
        _id: 'my-doc',
        type: 'uuidMustEqualDocType',
        equalityValidationProp: '5e7f697b-fe56-4b98-a68b-aae104bff1d4'
      };

      testHelper.verifyDocumentCreated(doc);
    });

    it('allows a UUID that differs only from the expected value by case', function() {
      var doc = {
        _id: 'my-doc',
        type: 'uuidMustEqualDocType',
        equalityValidationProp: '5E7F697B-FE56-4B98-A68B-AAE104BFF1D4'
      };

      testHelper.verifyDocumentCreated(doc);
    });

    it('rejects a UUID that differs from the expected value by one character', function() {
      var doc = {
        _id: 'my-doc',
        type: 'uuidMustEqualDocType',
        equalityValidationProp: '5e7f697b-fe56-4b98-a68b-aae104bff1d3'
      };

      testHelper.verifyDocumentNotCreated(
        doc,
        'uuidMustEqualDocType',
        [ errorFormatter.mustEqualViolation('equalityValidationProp', '5e7f697b-fe56-4b98-a68b-aae104bff1d4') ]);
    });
  });
});
