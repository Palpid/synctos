// This sync function for Couchbase Sync Gateway was generated by synctos: https://github.com/Kashoo/synctos
// More info on sync functions: http://developer.couchbase.com/mobile/develop/guides/sync-gateway/sync-function-api-guide/index.html
function synctos(doc, oldDoc) {
  // Determine if a given value is an integer. Exists as a failsafe because Number.isInteger is not guaranteed to exist in all environments.
  var isInteger = Number.isInteger || function(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
  };

  // Check that a given value is a valid ISO 8601 format date string with optional time and time zone components
  function isIso8601DateTimeString(value) {
    var regex = new RegExp('^(([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))([T ]([01][0-9]|2[0-4])(:[0-5][0-9])?(:[0-5][0-9])?([\\.,][0-9]{1,3})?)?([zZ]|([\\+-])([01][0-9]|2[0-3]):?([0-5][0-9])?)?$');

    return regex.test(value);
  }

  // Check that a given value is a valid ISO 8601 date string without time and time zone components
  function isIso8601DateString(value) {
    var regex = new RegExp('^(([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))$');

    return regex.test(value);
  }

  // Whether the given value is either null or undefined
  function isValueNullOrUndefined(value) {
    return typeof(value) === 'undefined' || value === null;
  }

  // A type filter that matches on the document's type property
  function simpleTypeFilter(doc, oldDoc, currentDocType) {
    if (oldDoc) {
      if (doc._deleted) {
        return oldDoc.type === currentDocType;
      } else {
        return doc.type === oldDoc.type && oldDoc.type === currentDocType;
      }
    } else {
      return doc.type === currentDocType;
    }
  }

  // Retrieves the old doc's effective value. If it is null, undefined or its "_deleted" property is true, returns null. Otherwise, returns
  // the value of the "oldDoc" parameter.
  function getEffectiveOldDoc(oldDoc) {
    return (oldDoc && !(oldDoc._deleted)) ? oldDoc : null;
  }

  // A document definition may define its authorizations (channels, roles or users) for each operation type (view, add, replace, delete or
  // write) as either a string or an array of strings. In either case, add them to the list if they are not already present.
  function appendToAuthorizationList(allAuthorizations, authorizationsToAdd) {
    if (!isValueNullOrUndefined(authorizationsToAdd)) {
      if (authorizationsToAdd instanceof Array) {
        for (var i = 0; i < authorizationsToAdd.length; i++) {
          var authorization = authorizationsToAdd[i];
          if (allAuthorizations.indexOf(authorization) < 0) {
            allAuthorizations.push(authorization);
          }
        }
      } else if (allAuthorizations.indexOf(authorizationsToAdd) < 0) {
        allAuthorizations.push(authorizationsToAdd);
      }
    }
  }

  // A document definition may define its authorized channels, roles or users as either a function or an object/hashtable
  function getAuthorizationMap(doc, oldDoc, authorizationDefinition) {
    if (typeof(authorizationDefinition) === 'function') {
      return authorizationDefinition(doc, getEffectiveOldDoc(oldDoc));
    } else {
      return authorizationDefinition;
    }
  }

  // Retrieves a list of channels the document belongs to based on its specified type
  function getAllDocChannels(doc, oldDoc, docDefinition) {
    var docChannelMap = getAuthorizationMap(doc, oldDoc, docDefinition.channels);

    var allChannels = [ ];
    if (docChannelMap) {
      appendToAuthorizationList(allChannels, docChannelMap.view);
      appendToAuthorizationList(allChannels, docChannelMap.write);
      appendToAuthorizationList(allChannels, docChannelMap.add);
      appendToAuthorizationList(allChannels, docChannelMap.replace);
      appendToAuthorizationList(allChannels, docChannelMap.remove);
    }

    return allChannels;
  }

  // Retrieves a list of authorizations (e.g. channels, roles, users) for the current document write operation type (add, replace or remove)
  function getRequiredAuthorizations(doc, oldDoc, authorizationDefinition) {
    var authorizationMap = getAuthorizationMap(doc, oldDoc, authorizationDefinition);

    if (isValueNullOrUndefined(authorizationMap)) {
      // This document type does not define any authorizations (channels, roles, users) at all
      return null;
    }

    var requiredAuthorizations = [ ];
    var writeAuthorizationFound = false;
    if (authorizationMap.write) {
      writeAuthorizationFound = true;
      appendToAuthorizationList(requiredAuthorizations, authorizationMap.write);
    }

    if (doc._deleted && authorizationMap.remove) {
      writeAuthorizationFound = true;
      appendToAuthorizationList(requiredAuthorizations, authorizationMap.remove);
    } else if (oldDoc && !oldDoc._deleted && authorizationMap.replace) {
      writeAuthorizationFound = true;
      appendToAuthorizationList(requiredAuthorizations, authorizationMap.replace);
    } else if (authorizationMap.add) {
      writeAuthorizationFound = true;
      appendToAuthorizationList(requiredAuthorizations, authorizationMap.add);
    }

    if (writeAuthorizationFound) {
      return requiredAuthorizations;
    } else {
      // This document type does not define any authorizations (channels, roles, users) that apply to this particular write operation type
      return null;
    }
  }

  // Ensures the user is authorized to create/replace/delete this document
  function authorize(doc, oldDoc, docDefinition) {
    var authorizedChannels = getRequiredAuthorizations(doc, oldDoc, docDefinition.channels);
    var authorizedRoles = getRequiredAuthorizations(doc, oldDoc, docDefinition.authorizedRoles);
    var authorizedUsers = getRequiredAuthorizations(doc, oldDoc, docDefinition.authorizedUsers);

    var channelMatch = false;
    if (authorizedChannels) {
      try {
        requireAccess(authorizedChannels);
        channelMatch = true;
      } catch (ex) {
        // The user has none of the authorized channels
        if (!authorizedRoles && !authorizedUsers) {
          // ... and the document definition does not specify any authorized roles or users
          throw ex;
        }
      }
    }

    var roleMatch = false;
    if (authorizedRoles) {
      try {
        requireRole(authorizedRoles);
        roleMatch = true;
      } catch (ex) {
        // The user belongs to none of the authorized roles
        if (!authorizedChannels && !authorizedUsers) {
          // ... and the document definition does not specify any authorized channels or users
          throw ex;
        }
      }
    }

    var userMatch = false;
    if (authorizedUsers) {
      try {
        requireUser(authorizedUsers);
        userMatch = true;
      } catch (ex) {
        // The user does not match any of the authorized usernames
        if (!authorizedChannels && !authorizedRoles) {
          // ... and the document definition does not specify any authorized channels or roles
          throw ex;
        }
      }
    }

    if (!authorizedChannels && !authorizedRoles && !authorizedUsers) {
      // The document type does not define any channels, roles or users that apply to this particular write operation type, so fall back to
      // Sync Gateway's default behaviour for an empty channel list: 403 Forbidden for requests via the public API and either 200 OK or 201
      // Created for requests via the admin API. That way, the admin API will always be able to create, replace or remove documents,
      // regardless of their authorized channels, roles or users, as intended.
      requireAccess([ ]);
    } else if (!channelMatch && !roleMatch && !userMatch) {
      // None of the authorization methods (e.g. channels, roles, users) succeeded
      throw({ forbidden: 'missing channel access' });
    }

    return {
      channels: authorizedChannels,
      roles: authorizedRoles,
      users: authorizedUsers
    };
  }

  // Constructs the fully qualified path of the item at the top of the given stack
  function buildItemPath(itemStack) {
    var nameComponents = [ ];
    for (var i = 0; i < itemStack.length; i++) {
      var itemName = itemStack[i].itemName;

      if (!itemName) {
        // Skip null or empty names (e.g. the first element is typically the root of the document, which has no name)
        continue;
      } else if (nameComponents.length < 1 || itemName.indexOf('[') === 0) {
        nameComponents.push(itemName);
      } else {
        nameComponents.push('.' + itemName);
      }
    }

    return nameComponents.join('');
  }

  // Ensures the document structure and content are valid
  function validateDoc(doc, oldDoc, docDefinition, docType) {
    var validationErrors = [ ];

    validateImmutableDoc(doc, oldDoc, docDefinition, validationErrors);

    // Only validate the document's contents if it's being created or replaced. But there's no need if it's being deleted.
    if (!doc._deleted) {
      if (!(docDefinition.allowAttachments) && doc._attachments) {
        for (var attachment in doc._attachments) {
          validationErrors.push('document type does not support attachments');

          break;
        }
      }

      var itemStack = [
        {
          itemValue: doc,
          oldItemValue: oldDoc,
          itemName: null
        }
      ];

      // Execute each of the document's property validators while ignoring these whitelisted properties at the root level
      var whitelistedProperties = [ '_id', '_rev', '_deleted', '_revisions', '_attachments' ];
      validateProperties(
        doc,
        oldDoc,
        docDefinition.propertyValidators,
        itemStack,
        validationErrors,
        docDefinition.allowUnknownProperties,
        whitelistedProperties);
    }

    if (validationErrors.length > 0) {
      throw { forbidden: 'Invalid ' + docType + ' document: ' + validationErrors.join('; ') };
    }
  }

  function validateImmutableDoc(doc, oldDoc, docDefinition, validationErrors) {
    if (oldDoc && !(oldDoc._deleted)) {
      if (docDefinition.immutable) {
        validationErrors.push('documents of this type cannot be replaced or deleted');
      } else if (doc._deleted) {
        if (docDefinition.cannotDelete) {
          validationErrors.push('documents of this type cannot be deleted');
        }
      } else {
        if (docDefinition.cannotReplace) {
          validationErrors.push('documents of this type cannot be replaced');
        }
      }
    }
  }

  function validateProperties(doc, oldDoc, propertyValidators, itemStack, validationErrors, allowUnknownProperties, whitelistedProperties) {
    var currentItemEntry = itemStack[itemStack.length - 1];
    var objectValue = currentItemEntry.itemValue;
    var oldObjectValue = currentItemEntry.oldItemValue;

    var supportedProperties = [ ];
    for (var propertyValidatorName in propertyValidators) {
      var validator = propertyValidators[propertyValidatorName];
      if (isValueNullOrUndefined(validator) || isValueNullOrUndefined(validator.type)) {
        // Skip over non-validator fields/properties
        continue;
      }

      var propertyValue = objectValue[propertyValidatorName];

      var oldPropertyValue;
      if (!isValueNullOrUndefined(oldObjectValue)) {
        oldPropertyValue = oldObjectValue[propertyValidatorName];
      }

      supportedProperties.push(propertyValidatorName);

      itemStack.push({
        itemValue: propertyValue,
        oldItemValue: oldPropertyValue,
        itemName: propertyValidatorName
      });

      validateItemValue(doc, oldDoc, validator, itemStack, validationErrors);

      itemStack.pop();
    }

    // Verify there are no unsupported properties in the object
    if (!allowUnknownProperties) {
      for (var propertyName in objectValue) {
        if (whitelistedProperties && whitelistedProperties.indexOf(propertyName) >= 0) {
          // These properties are special cases that should always be allowed - generally only applied at the root level of the document
          continue;
        }

        if (supportedProperties.indexOf(propertyName) < 0) {
          var objectPath = buildItemPath(itemStack);
          var fullPropertyPath = objectPath ? objectPath + '.' + propertyName : propertyName;
          validationErrors.push('property "' + fullPropertyPath + '" is not supported');
        }
      }
    }
  }

  function validateItemValue(doc, oldDoc, validator, itemStack, validationErrors) {
    var currentItemEntry = itemStack[itemStack.length - 1];
    var itemValue = currentItemEntry.itemValue;

    if (validator.customValidation) {
      performCustomValidation(doc, oldDoc, validator, itemStack, validationErrors);
    }

    if (validator.immutable) {
      validateImmutable(doc, oldDoc, itemStack, validationErrors, false);
    }

    if (validator.immutableWhenSet) {
      validateImmutable(doc, oldDoc, itemStack, validationErrors, true);
    }

    if (!isValueNullOrUndefined(itemValue)) {
      if (validator.mustNotBeEmpty && itemValue.length < 1) {
        validationErrors.push('item "' + buildItemPath(itemStack) + '" must not be empty');
      }

      if (!isValueNullOrUndefined(validator.minimumValue)) {
        var minComparator = function(left, right) {
          return left < right;
        };
        validateRangeConstraint(validator.minimumValue, validator.type, itemStack, minComparator, 'less than', validationErrors);
      }

      if (!isValueNullOrUndefined(validator.minimumValueExclusive)) {
        var minExclusiveComparator = function(left, right) {
          return left <= right;
        };
        validateRangeConstraint(
          validator.minimumValueExclusive,
          validator.type,
          itemStack,
          minExclusiveComparator,
          'less than or equal to',
          validationErrors);
      }

      if (!isValueNullOrUndefined(validator.maximumValue)) {
        var maxComparator = function(left, right) {
          return left > right;
        };
        validateRangeConstraint(validator.maximumValue, validator.type, itemStack, maxComparator, 'greater than', validationErrors);
      }

      if (!isValueNullOrUndefined(validator.maximumValueExclusive)) {
        var maxExclusiveComparator = function(left, right) {
          return left >= right;
        };
        validateRangeConstraint(
          validator.maximumValueExclusive,
          validator.type,
          itemStack,
          maxExclusiveComparator,
          'greater than or equal to',
          validationErrors);
      }

      if (!isValueNullOrUndefined(validator.minimumLength) && itemValue.length < validator.minimumLength) {
        validationErrors.push('length of item "' + buildItemPath(itemStack) + '" must not be less than ' + validator.minimumLength);
      }

      if (!isValueNullOrUndefined(validator.maximumLength) && itemValue.length > validator.maximumLength) {
        validationErrors.push('length of item "' + buildItemPath(itemStack) + '" must not be greater than ' + validator.maximumLength);
      }

      switch (validator.type) {
        case 'string':
          if (typeof itemValue !== 'string') {
            validationErrors.push('item "' + buildItemPath(itemStack) + '" must be a string');
          } else if (validator.regexPattern && !(validator.regexPattern.test(itemValue))) {
            validationErrors.push('item "' + buildItemPath(itemStack) + '" must conform to expected format ' + validator.regexPattern);
          }
          break;
        case 'integer':
          if (!isInteger(itemValue)) {
            validationErrors.push('item "' + buildItemPath(itemStack) + '" must be an integer');
          }
          break;
        case 'float':
          if (typeof itemValue !== 'number') {
            validationErrors.push('item "' + buildItemPath(itemStack) + '" must be a floating point or integer number');
          }
          break;
        case 'boolean':
          if (typeof itemValue !== 'boolean') {
            validationErrors.push('item "' + buildItemPath(itemStack) + '" must be a boolean');
          }
          break;
        case 'datetime':
          if (typeof itemValue !== 'string' || !isIso8601DateTimeString(itemValue)) {
            validationErrors.push('item "' + buildItemPath(itemStack) + '" must be an ISO 8601 date string with optional time and time zone components');
          }
          break;
        case 'date':
          if (typeof itemValue !== 'string' || !isIso8601DateString(itemValue)) {
            validationErrors.push('item "' + buildItemPath(itemStack) + '" must be an ISO 8601 date string with no time or time zone components');
          }
          break;
        case 'object':
          if (typeof itemValue !== 'object' || itemValue instanceof Array) {
            validationErrors.push('item "' + buildItemPath(itemStack) + '" must be an object');
          } else if (validator.propertyValidators) {
            validateProperties(doc, oldDoc, validator.propertyValidators, itemStack, validationErrors, validator.allowUnknownProperties);
          }
          break;
        case 'array':
          validateArray(doc, oldDoc, validator.arrayElementsValidator, itemStack, validationErrors);
          break;
        case 'hashtable':
          validateHashtable(
            doc,
            oldDoc,
            validator.hashtableKeysValidator,
            validator.hashtableValuesValidator,
            itemStack,
            validationErrors);
          break;
        case 'attachmentReference':
          validateAttachmentRef(doc, oldDoc, validator, itemStack, validationErrors);
          break;
        default:
          // This is not a document validation error; the item validator is configured incorrectly and must be fixed
          throw({ forbidden: 'No data type defined for validator of item "' + buildItemPath(itemStack) + '"' });
      }
    } else if (validator.required) {
      // The item has no value (either it's null or undefined), but the validator indicates it is required
      validationErrors.push('required item "' + buildItemPath(itemStack) + '" is missing');
    }
  }

  function validateImmutable(doc, oldDoc, itemStack, validationErrors, onlyEnforceIfHasValue) {
    if (oldDoc && !(oldDoc._deleted)) {
      var currentItemEntry = itemStack[itemStack.length - 1];
      var itemValue = currentItemEntry.itemValue;
      var oldItemValue = currentItemEntry.oldItemValue;

      if (onlyEnforceIfHasValue && isValueNullOrUndefined(oldItemValue)) {
        // No need to continue; the constraint only applies if the old value is neither null nor undefined
        return;
      }

      // Only compare the item's value to the old item if the item's parent existed in the old document. For example, if the item in
      // question is the value of a property in an object that is itself in an array, but the object did not exist in the array in the old
      // document, then there is nothing to validate.
      var oldParentItemValue = (itemStack.length >= 2) ? itemStack[itemStack.length - 2].oldItemValue : null;
      var constraintSatisfied;
      if (isValueNullOrUndefined(oldParentItemValue)) {
        constraintSatisfied = true;
      } else {
        constraintSatisfied = validateImmutableItem(itemValue, oldItemValue);
      }

      if (!constraintSatisfied) {
        validationErrors.push('value of item "' + buildItemPath(itemStack) + '" may not be modified');
      }
    }
  }

  function validateImmutableItem(itemValue, oldItemValue) {
    var itemMissing = isValueNullOrUndefined(itemValue);
    var oldItemMissing = isValueNullOrUndefined(oldItemValue);
    if (oldItemValue === itemValue || (itemMissing && oldItemMissing)) {
      return true;
    } else if (itemMissing !== oldItemMissing) {
      // One value is null or undefined but the other is not, so they cannot be equal
      return false;
    } else {
      if (itemValue instanceof Array || oldItemValue instanceof Array) {
        return validateImmutableArray(itemValue, oldItemValue);
      } else if (typeof(itemValue) === 'object' || typeof(oldItemValue) === 'object') {
        return validateImmutableObject(itemValue, oldItemValue);
      } else {
        return false;
      }
    }
  }

  function validateImmutableArray(itemValue, oldItemValue) {
    if (!(itemValue instanceof Array && oldItemValue instanceof Array)) {
      return false;
    } else if (itemValue.length !== oldItemValue.length) {
      return false;
    }

    for (var elementIndex = 0; elementIndex < itemValue.length; elementIndex++) {
      var elementValue = itemValue[elementIndex];
      var oldElementValue = oldItemValue[elementIndex];

      if (!validateImmutableItem(elementValue, oldElementValue)) {
        return false;
      }
    }

    // If we got here, all elements match
    return true;
  }

  function validateImmutableObject(itemValue, oldItemValue) {
    if (typeof(itemValue) !== 'object' || typeof(oldItemValue) !== 'object') {
      return false;
    }

    var itemProperties = [ ];
    for (var itemProp in itemValue) {
      itemProperties.push(itemProp);
    }

    for (var oldItemProp in oldItemValue) {
      if (itemProperties.indexOf(oldItemProp) < 0) {
        itemProperties.push(oldItemProp);
      }
    }

    for (var propIndex = 0; propIndex < itemProperties.length; propIndex++) {
      var propertyName = itemProperties[propIndex];
      var propertyValue = itemValue[propertyName];
      var oldPropertyValue = oldItemValue[propertyName];

      if (!validateImmutableItem(propertyValue, oldPropertyValue)) {
        return false;
      }
    }

    // If we got here, all properties match
    return true;
  }

  function validateRangeConstraint(rangeLimit, validationType, itemStack, comparator, violationDescription, validationErrors) {
    var itemValue = itemStack[itemStack.length - 1].itemValue;
    var outOfRange;
    if (validationType === 'datetime') {
      // Date/times require special handling because their time and time zone components are optional and time zones may differ
      try {
        outOfRange = comparator(new Date(itemValue).getTime(), new Date(rangeLimit).getTime());
      } catch (ex) {
        // The date/time's format may be invalid but it isn't technically in violation of the range constraint
        outOfRange = false;
      }
    } else if (comparator(itemValue, rangeLimit)) {
      outOfRange = true;
    }

    if (outOfRange) {
      validationErrors.push('item "' + buildItemPath(itemStack) + '" must not be ' + violationDescription + ' ' + rangeLimit);
    }
  }

  function validateArray(doc, oldDoc, elementValidator, itemStack, validationErrors) {
    var currentItemEntry = itemStack[itemStack.length - 1];
    var itemValue = currentItemEntry.itemValue;
    var oldItemValue = currentItemEntry.oldItemValue;

    if (!(itemValue instanceof Array)) {
      validationErrors.push('item "' + buildItemPath(itemStack) + '" must be an array');
    } else if (elementValidator) {
      // Validate each element in the array
      for (var elementIndex = 0; elementIndex < itemValue.length; elementIndex++) {
        var elementName = '[' + elementIndex + ']';
        var elementValue = itemValue[elementIndex];

        var oldElementValue;
        if (!isValueNullOrUndefined(oldItemValue) && elementIndex < oldItemValue.length) {
          oldElementValue = oldItemValue[elementIndex];
        }

        itemStack.push({
          itemName: elementName,
          itemValue: elementValue,
          oldItemValue: oldElementValue
        });

        validateItemValue(
          doc,
          oldDoc,
          elementValidator,
          itemStack,
          validationErrors);

        itemStack.pop();
      }
    }
  }

  function validateHashtable(doc, oldDoc, keyValidator, valueValidator, itemStack, validationErrors) {
    var currentItemEntry = itemStack[itemStack.length - 1];
    var itemValue = currentItemEntry.itemValue;
    var oldItemValue = currentItemEntry.oldItemValue;

    if (typeof itemValue !== 'object' || itemValue instanceof Array) {
      validationErrors.push('item "' + buildItemPath(itemStack) + '" must be an object/hashtable');
    } else {
      for (var elementKey in itemValue) {
        var elementValue = itemValue[elementKey];

        var elementName = '[' + elementKey + ']';
        if (keyValidator) {
          var hashtablePath = buildItemPath(itemStack);
          var fullKeyPath = hashtablePath ? hashtablePath + elementName : elementName;
          if (typeof elementKey !== 'string') {
            validationErrors.push('hashtable key "' + fullKeyPath + '" is not a string');
          } else {
            if (keyValidator.mustNotBeEmpty && elementKey.length < 1) {
              validationErrors.push('empty hashtable key in item "' + buildItemPath(itemStack) + '" is not allowed');
            }
            if (keyValidator.regexPattern && !(keyValidator.regexPattern.test(elementKey))) {
              validationErrors.push('hashtable key "' + fullKeyPath + '" does not conform to expected format ' + keyValidator.regexPattern);
            }
          }
        }

        if (valueValidator) {
          var oldElementValue;
          if (!isValueNullOrUndefined(oldItemValue)) {
            oldElementValue = oldItemValue[elementKey];
          }

          itemStack.push({
            itemName: elementName,
            itemValue: elementValue,
            oldItemValue: oldElementValue
          });

          validateItemValue(
            doc,
            oldDoc,
            valueValidator,
            itemStack,
            validationErrors);

          itemStack.pop();
        }
      }
    }
  }

  function validateAttachmentRef(doc, oldDoc, validator, itemStack, validationErrors) {
    var currentItemEntry = itemStack[itemStack.length - 1];
    var itemValue = currentItemEntry.itemValue;

    if (typeof itemValue !== 'string') {
      validationErrors.push('attachment reference "' + buildItemPath(itemStack) + '" must be a string');
    } else {
      if (validator.supportedExtensions) {
        var extRegex = new RegExp('\\.(' + validator.supportedExtensions.join('|') + ')$', 'i');
        if (!extRegex.test(itemValue)) {
          validationErrors.push('attachment reference "' + buildItemPath(itemStack) + '" must have a supported file extension (' + validator.supportedExtensions.join(',') + ')');
        }
      }

      // Because the addition of an attachment is typically a separate operation from the creation/update of the associated document, we
      // can't guarantee that the attachment is present when the attachment reference property is created/updated for it, so only
      // validate it if it's present. The good news is that, because adding an attachment is a two part operation (create/update the
      // document and add the attachment), the sync function will be run once for each part, thus ensuring the content is verified once
      // both parts have been synced.
      if (doc._attachments && doc._attachments[itemValue]) {
        var attachment = doc._attachments[itemValue];

        if (validator.supportedContentTypes && validator.supportedContentTypes.indexOf(attachment.content_type) < 0) {
            validationErrors.push('attachment reference "' + buildItemPath(itemStack) + '" must have a supported content type (' + validator.supportedContentTypes.join(',') + ')');
        }

        if (!isValueNullOrUndefined(validator.maximumSize) && attachment.length > validator.maximumSize) {
          validationErrors.push('attachment reference "' + buildItemPath(itemStack) + '" must not be larger than ' + validator.maximumSize + ' bytes');
        }
      }
    }
  }

  function performCustomValidation(doc, oldDoc, validator, itemStack, validationErrors) {
    var currentItemEntry = itemStack[itemStack.length - 1];

    // Copy all but the last/top element so that the item's parent is at the top of the stack for the custom validation function
    var customValidationItemStack = itemStack.slice(-1);

    var customValidationErrors = validator.customValidation(doc, oldDoc, currentItemEntry, customValidationItemStack);

    if (customValidationErrors instanceof Array) {
      for (var errorIndex = 0; errorIndex < customValidationErrors.length; errorIndex++) {
        validationErrors.push(customValidationErrors[errorIndex]);
      }
    }
  }

  // Adds a prefix to the specified item if the prefix is defined
  function prefixItem(item, prefix) {
    return (prefix ? prefix + item : item.toString());
  }

  // Transforms the given item or items into a new list of items with the specified prefix (if any) appended to each element
  function resolveCollectionItems(originalItems, itemPrefix) {
    if (isValueNullOrUndefined(originalItems)) {
      return [ ];
    } else if (originalItems instanceof Array) {
      var resultItems = [ ];
      for (var i = 0; i < originalItems.length; i++) {
        var item = originalItems[i];

        if (isValueNullOrUndefined(item)) {
          continue;
        }

        resultItems.push(prefixItem(item, itemPrefix));
      }

      return resultItems;
    } else {
      // Represents a single item
      return [ prefixItem(originalItems, itemPrefix) ];
    }
  }

  // Transforms the given collection definition, which may have been defined as a single item, a list of items or a function that returns a
  // list of items into a simple list, where each item has the specified prefix, if any
  function resolveCollectionDefinition(doc, oldDoc, collectionDefinition, itemPrefix) {
    if (isValueNullOrUndefined(collectionDefinition)) {
      return [ ];
    } else {
      if (typeof(collectionDefinition) === 'function') {
        var fnResults = collectionDefinition(doc, oldDoc);

        return resolveCollectionItems(fnResults, itemPrefix);
      } else {
        return resolveCollectionItems(collectionDefinition, itemPrefix);
      }
    }
  }

  // Assigns channels to users and roles according to the given access assignment definitions
  function assignUserAccess(doc, oldDoc, accessAssignmentDefinitions) {
    var effectiveOldDoc = getEffectiveOldDoc(oldDoc);

    var effectiveAssignments = [ ];
    for (var assignmentIndex = 0; assignmentIndex < accessAssignmentDefinitions.length; assignmentIndex++) {
      var definition = accessAssignmentDefinitions[assignmentIndex];
      var usersAndRoles = [ ];

      var users = resolveCollectionDefinition(doc, effectiveOldDoc, definition.users);
      for (var userIndex = 0; userIndex < users.length; userIndex++) {
        usersAndRoles.push(users[userIndex]);
      }

      // Role names must begin with the special token "role:" to distinguish them from users
      var roles = resolveCollectionDefinition(doc, effectiveOldDoc, definition.roles, 'role:');
      for (var roleIndex = 0; roleIndex < roles.length; roleIndex++) {
        usersAndRoles.push(roles[roleIndex]);
      }

      var channels = resolveCollectionDefinition(doc, effectiveOldDoc, definition.channels);

      access(usersAndRoles, channels);

      effectiveAssignments.push({
        type: 'channel',
        usersAndRoles: usersAndRoles,
        channels: channels
      });
    }

    return effectiveAssignments;
  }

  var rawDocDefinitions = %SYNC_DOCUMENT_DEFINITIONS%;

  var docDefinitions;
  if (typeof rawDocDefinitions === 'function') {
    docDefinitions = rawDocDefinitions();
  } else {
    docDefinitions = rawDocDefinitions;
  }

  function getDocumentType(doc, oldDoc) {
    var effectiveOldDoc = getEffectiveOldDoc(oldDoc);

    for (var docType in docDefinitions) {
      var docDefn = docDefinitions[docType];
      if (docDefn.typeFilter(doc, effectiveOldDoc, docType)) {
        return docType;
      }
    }

    // The document type does not exist
    return null;
  }


  // Now put the pieces together
  var theDocType = getDocumentType(doc, oldDoc);

  if (isValueNullOrUndefined(theDocType)) {
    throw({ forbidden: 'Unknown document type' });
  }

  var theDocDefinition = docDefinitions[theDocType];

  var customActionMetadata = {
    documentTypeId: theDocType,
    documentDefinition: theDocDefinition
  };

  if (theDocDefinition.customActions && typeof(theDocDefinition.customActions.onTypeIdentificationSucceeded) === 'function') {
    theDocDefinition.customActions.onTypeIdentificationSucceeded(doc, oldDoc, customActionMetadata);
  }

  customActionMetadata.authorization = authorize(doc, oldDoc, theDocDefinition);

  if (theDocDefinition.customActions && typeof(theDocDefinition.customActions.onAuthorizationSucceeded) === 'function') {
    theDocDefinition.customActions.onAuthorizationSucceeded(doc, oldDoc, customActionMetadata);
  }

  validateDoc(doc, oldDoc, theDocDefinition, theDocType);

  if (theDocDefinition.customActions && typeof(theDocDefinition.customActions.onValidationSucceeded) === 'function') {
    theDocDefinition.customActions.onValidationSucceeded(doc, oldDoc, customActionMetadata);
  }

  if (theDocDefinition.accessAssignments) {
    customActionMetadata.accessAssignments = assignUserAccess(doc, oldDoc, theDocDefinition.accessAssignments);

    if (theDocDefinition.customActions && typeof(theDocDefinition.customActions.onAccessAssignmentsSucceeded) === 'function') {
      theDocDefinition.customActions.onAccessAssignmentsSucceeded(doc, oldDoc, customActionMetadata);
    }
  }

  // Getting here means the document write is authorized and valid, and the appropriate channel(s) should now be assigned
  var allDocChannels = getAllDocChannels(doc, oldDoc, theDocDefinition);
  channel(allDocChannels);
  customActionMetadata.documentChannels = allDocChannels;

  if (theDocDefinition.customActions && typeof(theDocDefinition.customActions.onDocumentChannelAssignmentSucceeded) === 'function') {
    theDocDefinition.customActions.onDocumentChannelAssignmentSucceeded(doc, oldDoc, customActionMetadata);
  }
}
