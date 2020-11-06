'use strict'
const joiConverter = module.exports = { }

const graphQl = require('graphql')
const readTypes = require('./readTypes.js')
const { GraphQLJSONObject } = require('graphql-type-json');
const { GraphQLJSON } = require('graphql-type-json');


joiConverter.simpleAttribute = (joiScheme, resourceName, attributeName) => {
  let type = joiScheme._type
  if (type === 'any') {
    // { _valids: { _set: [ 'M', 'F' ] } }
    type = typeof (joiScheme._valids._set || [ ])[0]
  }
  if (type === 'date') {
    return graphQl.GraphQLString
  }
  if (type === 'number') {
    type = 'float'
    return graphQl.GraphQLFloat
  }
  if (type === 'object') {
    return GraphQLJSONObject
  }

  if (type === 'array') {
    const items = joiScheme._inner.items

    if (items.length === 1) {
      const type = joiConverter.simpleAttribute(items[0], resourceName, attributeName)
      return new graphQl.GraphQLList(type)
    }

    new graphQl.GraphQLList(GraphQLJSON)
  }

  const uType  = type[0].toUpperCase() + type.substring(1)
  const qlType = graphQl[`GraphQL${uType}`]

  if (!qlType) {
    // use JSON scalar in this case.
    return GraphQLJSON
  }
  return qlType
}


joiConverter.swap = (joiScheme, graphQlResources, resourceName, attributeName) => {
  let type
  if (!joiScheme._settings) {
    type = joiConverter.simpleAttribute(joiScheme, resourceName, attributeName)
  } else {
    let otherType = joiScheme._settings.__one || joiScheme._settings.__many
    otherType = otherType.join(readTypes.UNION_JOIN_CONST)
    type = graphQlResources[otherType]

    if (joiScheme._settings.__many) {
      type = new graphQl.GraphQLList(type)
    }
  }

  if ((joiScheme._flags || { }).presence === 'required') {
    type = new graphQl.GraphQLNonNull(type)
  }
  return type
}

joiConverter.shallowInput = (joiScheme, allWriteTypes, resourceName, attributeName) => {
  let type
  if (!joiScheme._settings) {
    type = joiConverter.simpleAttribute(joiScheme, resourceName, attributeName)
  } else {
    type = oneRelationship
    if (joiScheme._settings.__many) {
      type = manyRelationship
    }
  }

  if ((joiScheme._flags || { }).presence === 'required') {
    type = new graphQl.GraphQLNonNull(type)
  }
  return type
}

const oneRelationship = new graphQl.GraphQLInputObjectType({
  name: 'oneRelationship',
  fields: {
    id: {
      type: new graphQl.GraphQLNonNull(graphQl.GraphQLString),
      description: 'The UUID of another resource'
    }
  }
})
const manyRelationship = new graphQl.GraphQLList(oneRelationship)
