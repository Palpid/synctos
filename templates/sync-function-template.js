// This sync function for Couchbase Sync Gateway was generated by synctos: https://github.com/Kashoo/synctos
function synctos(doc, oldDoc) {
  // Whether the given value is either null or undefined
  function isValueNullOrUndefined(value) {
    return typeof value === 'undefined' || value === null;
  }

  // Whether the given document is missing/nonexistant (i.e. null or undefined) or deleted (its "_deleted" property is true)
  function isDocumentMissingOrDeleted(candidate) {
    return isValueNullOrUndefined(candidate) || candidate._deleted;
  }

  // A property validator that is suitable for use on type identifier properties. Ensures the value is a string, is neither null nor
  // undefined, is not an empty string and cannot be modified.
  var typeIdValidator = {
    type: 'string',
    required: true,
    mustNotBeEmpty: true,
    immutable: true
  };

  // A type filter that matches on the document's type property
  function simpleTypeFilter(doc, oldDoc, candidateDocType) {
    if (oldDoc) {
      if (doc._deleted) {
        return oldDoc.type === candidateDocType;
      } else {
        return doc.type === oldDoc.type && oldDoc.type === candidateDocType;
      }
    } else {
      return doc.type === candidateDocType;
    }
  }

  // Retrieves the old doc's effective value. If it is null, undefined or its "_deleted" property is true, returns null. Otherwise, returns
  // the value of the "oldDoc" parameter.
  function getEffectiveOldDoc(oldDoc) {
    return !isDocumentMissingOrDeleted(oldDoc) ? oldDoc : null;
  }

  // Add the specified padding to the right of the given string value until its length matches the desired length
  function padRight(value, desiredLength, padding) {
    while (value.length < desiredLength) {
      value += padding;
    }

    return value;
  }

  var jsonStringify = importSyncFunctionFragment('json-stringify-module.js');

  // Load the document authorization module
  var authorizationModule = importSyncFunctionFragment('sync-function-authorization-module.js')();

  // Load the document validation module
  var validationModule = importSyncFunctionFragment('sync-function-validation-module.js')();

  // Load the access assignment module
  var accessAssignmentModule = importSyncFunctionFragment('sync-function-access-assignment-module.js')();

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
    if (isDocumentMissingOrDeleted(oldDoc) && isDocumentMissingOrDeleted(doc)) {
      // Attempting to delete a document that does not exist. This may occur when bucket access/sharing
      // (https://developer.couchbase.com/documentation/mobile/current/guides/sync-gateway/shared-bucket-access.html)
      // is enabled and the document was deleted via the Couchbase SDK. Skip everything else and simply assign the
      // public channel
      // (https://developer.couchbase.com/documentation/mobile/current/guides/sync-gateway/channels/index.html#special-channels)
      // to the document so that users will get a 404 Not Found if they attempt to fetch (i.e. "view") the deleted
      // document rather than a 403 Forbidden.
      requireAccess('!');
      channel('!');

      return;
    } else {
      throw { forbidden: 'Unknown document type' };
    }
  }

  var theDocDefinition = docDefinitions[theDocType];

  var customActionMetadata = {
    documentTypeId: theDocType,
    documentDefinition: theDocDefinition
  };

  if (theDocDefinition.customActions && typeof theDocDefinition.customActions.onTypeIdentificationSucceeded === 'function') {
    theDocDefinition.customActions.onTypeIdentificationSucceeded(doc, oldDoc, customActionMetadata);
  }

  customActionMetadata.authorization = authorizationModule.authorize(doc, oldDoc, theDocDefinition);

  if (theDocDefinition.customActions && typeof theDocDefinition.customActions.onAuthorizationSucceeded === 'function') {
    theDocDefinition.customActions.onAuthorizationSucceeded(doc, oldDoc, customActionMetadata);
  }

  validationModule.validateDoc(doc, oldDoc, theDocDefinition, theDocType);

  if (theDocDefinition.customActions && typeof theDocDefinition.customActions.onValidationSucceeded === 'function') {
    theDocDefinition.customActions.onValidationSucceeded(doc, oldDoc, customActionMetadata);
  }

  if (theDocDefinition.accessAssignments && theDocDefinition.accessAssignments.length > 0 && !doc._deleted) {
    customActionMetadata.accessAssignments = accessAssignmentModule.assignUserAccess(doc, oldDoc, theDocDefinition.accessAssignments);

    if (theDocDefinition.customActions && typeof theDocDefinition.customActions.onAccessAssignmentsSucceeded === 'function') {
      theDocDefinition.customActions.onAccessAssignmentsSucceeded(doc, oldDoc, customActionMetadata);
    }
  }

  // Getting here means the document revision is authorized and valid, and the appropriate channel(s) should now be assigned
  var allDocChannels = authorizationModule.getAllDocChannels(doc, oldDoc, theDocDefinition);
  channel(allDocChannels);
  customActionMetadata.documentChannels = allDocChannels;

  if (theDocDefinition.customActions && typeof theDocDefinition.customActions.onDocumentChannelAssignmentSucceeded === 'function') {
    theDocDefinition.customActions.onDocumentChannelAssignmentSucceeded(doc, oldDoc, customActionMetadata);
  }
}
