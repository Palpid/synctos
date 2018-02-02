var expect = require('chai').expect;
var docDefinitionsLoader = require('../document-definitions-loader');
var validator = require('./document-definitions-validator');

describe('Document definitions validator:', function() {
  it('performs validation on the sample document definitions file', function() {
    var filePath = 'samples/sample-sync-doc-definitions.js';
    var sampleDocDefinitions = docDefinitionsLoader.load(filePath);

    var results = validator.validate(sampleDocDefinitions, filePath);

    expect(results.length).to.equal(0);
  });

  it('performs validation on a document definitions object', function() {
    var fakeDocDefinitions = {
      myDoc1: { }
    };

    var results = validator.validate(fakeDocDefinitions);

    expect(results).to.have.members(
      [
        'myDoc1: "value" must contain at least one of [channels, authorizedRoles, authorizedUsers]',
        'myDoc1.typeFilter: "typeFilter" is required',
        'myDoc1.propertyValidators: "propertyValidators" is required'
      ]);
  });

  it('performs validation on a document definitions function', function() {
    var fakeDocDefinitions = function() {
      return {
        myDoc1: {
          typeFilter: function() { },
          channels: { }, // Must have at least one permission type
          authorizedRoles: { }, // Must have at least one permission type
          authorizedUsers: { }, // Must have at least one permission type
          attachmentConstraints: { // Should only be specified in conjunction with the "allowAttachments" property
            maximumAttachmentCount: 0, // Must be at least 1
            maximumIndividualSize: 20971521, // Must be no greater than 20971520 (the max Sync Gateway attachment size)
            maximumTotalSize: -3, // Must be at least 1
            supportedExtensions: function(doc, oldDoc, extraParam) { // Has too many params
              return [ extraParam ];
            },
            supportedContentTypes: [ ] // Must have at least one element
          },
          propertyValidators: {
            _invalidName: { // Sync Gateway does not allow top-level property validators to start with underscore
              type: 'string'
            },
            nestedObject: {
              type: 'object',
              unrecognizedConstraint: true, // Invalid property constraint
              propertyValidators: {
                dateProperty: {
                  type: 'date',
                  required: true,
                  immutable: false,
                  minimumValue: '2018-01-31T17:31:27.283-08:00' // Should not include time and time zone components
                },
                hashtableProperty: {
                  type: 'hashtable',
                  maximumSize: -1, // Must be at least zero
                  hashtableKeysValidator: {
                    regexPattern: '^[a-z]+$' // Must actually be either a literal regex or a RegExp object
                  },
                  hashtableValuesValidator: {
                    type: 'datetime',
                    maximumValueExclusive: new Date(2018, 0, 31, 17, 31, 27, 283),
                    mustEqual: '2018-01-31T17:31:27.283-08:00' // Should not be defined in conjunction with maximumValueExclusive
                  }
                },
                arrayProperty: {
                  type: 'array',
                  minimumLength: 1.5, // Must be an integer
                  arrayElementsValidator: {
                    type: 'object',
                    allowUnknownProperties: true,
                    required: function(doc, oldDoc, value, oldValue) {
                      return oldValue === true;
                    },
                    propertyValidators: {
                      stringProperty: {
                        type: 'string',
                        regexPattern: /^[a-z]+$/,
                        maximumLength: function() { return 9; }
                      },
                      uuidProperty: {
                        type: 'uuid',
                        minimumValue: '4050b662-4383-4d2E-8771-54d380d11C41',
                        maximumValue: '1234' // Not a valid UUID
                      },
                      noTypeProperty: { // The required "type" property is required
                        required: true
                      },
                      emptyPropertyValidatorsProperty: {
                        type: 'object',
                        propertyValidators: { } // Must specify at least one property validator
                      }
                    }
                  }
                },
                unrecognizedTypeProperty: {
                  type: 'foobar' // Not a supported validation constraint type
                }
              }
            }
          }
        }
      };
    };

    var results = validator.validate(fakeDocDefinitions);

    expect(results).to.have.members(
      [
        'myDoc1.channels: \"channels\" must have at least 1 children',
        'myDoc1.authorizedRoles: \"authorizedRoles\" must have at least 1 children',
        'myDoc1.authorizedUsers: \"authorizedUsers\" must have at least 1 children',
        'myDoc1.attachmentConstraints: "attachmentConstraints" missing required peer "allowAttachments"',
        'myDoc1.attachmentConstraints.maximumAttachmentCount: \"maximumAttachmentCount\" must be larger than or equal to 1',
        'myDoc1.attachmentConstraints.maximumIndividualSize: \"maximumIndividualSize\" must be less than or equal to 20971520',
        'myDoc1.attachmentConstraints.maximumTotalSize: \"maximumTotalSize\" must be larger than or equal to 1',
        'myDoc1.attachmentConstraints.supportedExtensions: "supportedExtensions" must have an arity lesser or equal to 2',
        'myDoc1.attachmentConstraints.supportedContentTypes: \"supportedContentTypes\" must contain at least 1 items',
        'myDoc1.propertyValidators._invalidName: "_invalidName" is not allowed',
        'myDoc1.propertyValidators.nestedObject.unrecognizedConstraint: "unrecognizedConstraint" is not allowed',
        'myDoc1.propertyValidators.nestedObject.propertyValidators.dateProperty.minimumValue: "minimumValue" with value "2018-01-31T17:31:27.283-08:00" fails to match the required pattern: /^(([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))$/',
        'myDoc1.propertyValidators.nestedObject.propertyValidators.hashtableProperty.maximumSize: "maximumSize" must be larger than or equal to 0',
        'myDoc1.propertyValidators.nestedObject.propertyValidators.hashtableProperty.hashtableKeysValidator.regexPattern: "regexPattern" must be an object',
        'myDoc1.propertyValidators.nestedObject.propertyValidators.hashtableProperty.hashtableValuesValidator.maximumValueExclusive: "maximumValueExclusive" conflict with forbidden peer "mustEqual"',
        'myDoc1.propertyValidators.nestedObject.propertyValidators.arrayProperty.minimumLength: "minimumLength" must be an integer',
        'myDoc1.propertyValidators.nestedObject.propertyValidators.arrayProperty.arrayElementsValidator.propertyValidators.uuidProperty.maximumValue: "maximumValue" must be a valid GUID',
        'myDoc1.propertyValidators.nestedObject.propertyValidators.arrayProperty.arrayElementsValidator.propertyValidators.emptyPropertyValidatorsProperty.propertyValidators: \"propertyValidators\" must have at least 1 children',
        'myDoc1.propertyValidators.nestedObject.propertyValidators.arrayProperty.arrayElementsValidator.propertyValidators.noTypeProperty.type: "type" is required',
        'myDoc1.propertyValidators.nestedObject.propertyValidators.unrecognizedTypeProperty.type: "type" must be one of [string, integer, float, boolean, datetime, date, enum, uuid, attachmentReference, array, object, hashtable]'
      ]);
  });
});
