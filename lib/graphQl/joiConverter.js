'use strict'
const joiConverter = module.exports = { }

const graphQl = require('graphql')
const readTypes = require('./readTypes.js')
const { GraphQLJSONObject } = require('graphql-type-json');

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

  if (type === 'array' || type === 'alternatives') {
    const items = (type === 'array') ? joiScheme._inner.items : joiScheme._inner.matches
    const types = items.map( item => joiConverter.simpleAttribute(item) )

    if (types.length === 0) {
      throw new Error(`Array attribute ${attributeName} in resource ${resourceName} must contains at least one definition of item ( use *items* )`)
    } else if (types.length === 1) {
      return new graphQl.GraphQLList(types[0])
    } else {
      const union = new graphQl.GraphQLUnionType({
        name:`${resourceName}:${attributeName}`,
        types,
        resolveType(value) {
          if (typeof value === 'object') {
            return graphQl.ObjectType
          }
          return graphQl.String
        }
      })
      return new graphQl.GraphQLList(union)
    }
  }

  const uType = type[0].toUpperCase() + type.substring(1)
  const qlType = graphQl[`GraphQL${uType}`]

  if (!qlType) {
    throw new Error(`Unable to parse Joi type for attribute ${attributeName} in resource ${resourceName}, got ${type}`)
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

joiConverter.shallowInput = joiScheme => {
  let type
  if (!joiScheme._settings) {
    type = joiConverter.simpleAttribute(joiScheme)
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
