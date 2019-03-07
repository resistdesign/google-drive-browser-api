const QUERY_GROUP_TYPE = 'array';
const QUERY_TYPE_PARSER_MAP = {
  'object': parseQueryObject,
  [QUERY_GROUP_TYPE]: parseQueryArray,
  'string': parseQueryString
};
const DEFAULT_QUERY_TYPE_PARSER = parseQueryString;
const VALUE_STRING_TYPE = 'string';
const VALUE_TYPE_PARSER_MAP = {
  [VALUE_STRING_TYPE]: parseValueString,
  'number': parseValueNumber,
  'boolean': parseValueBoolean,
  'date': parseValueDate,
  'object': parseValueObject,
  'array': parseValueArray
};
const DEFAULT_VALUE_TYPE_PARSER = parseValueDate;

export const OPERATORS = {
  CONTAINS: 'contains',
  EQUALS: '=',
  DOES_NOT_EQUAL: '!=',
  LESS_THAN: '<',
  LESS_THAN_OR_EQUAL_TO: '<=',
  GREATER_THAN: '>',
  GREATER_THAN_OR_EQUAL_TO: '>=',
  IN: 'in',
  HAS: 'has'
};
export const OPERATOR_NEGATOR = 'not';
export const CONJUNCTIONS = {
  AND: 'and',
  OR: 'or'
};

export function parseValueString(valueString = '', omitQuotes = false) {
  if (omitQuotes) {
    return `${valueString}`;
  } else {
    const cleanValue = `${valueString}`
      .split('\\')
      .join('\\\\')
      .split(`'`)
      .join(`\'`);

    return `'${cleanValue}'`;
  }
}

export function parseValueNumber(valueNumber = 0) {
  return `${valueNumber}`;
}

export function parseValueBoolean(valueBoolean = false) {
  return `${valueBoolean}`;
}

export function parseValueDate(valueDate = new Date()) {
  return `'${valueDate}'`;
}

export function parseValueObject(valueObject = {}) {
  const {negated, key, operator = OPERATORS.EQUALS, value} = valueObject;
  const negationString = `${negated ? `${OPERATOR_NEGATOR} ` : ''}`;

  return `key${OPERATORS.EQUALS}'${key}' and ${negationString}value${operator}${parseValue(value)}`;
}

export function parseValueArray(valueArray = []) {
  const parsedValue = valueArray.map(q => parseValue(q, false)).join(' ');

  return `{ ${parsedValue} }`;
}

export function parseValue(value = '', quoteString = true) {
  const valueType = value instanceof Date ?
    'date' :
    value instanceof Array ? 'array' : typeof value;
  const parser = VALUE_TYPE_PARSER_MAP[valueType] || DEFAULT_VALUE_TYPE_PARSER;

  if (!quoteString && valueType === VALUE_STRING_TYPE) {
    return parser(value, true);
  } else {
    return parser(value);
  }
}

export function parseQueryString(queryString = '') {
  return `${queryString}`;
}

export function parseQueryObject(queryObject = {}) {
  const {negated, key, operator = OPERATORS.EQUALS, value} = queryObject;

  if (operator === OPERATORS.HAS && !(value instanceof Array)) {
    const error = new Error(`Invalid value for key '${key}' with ${OPERATORS.HAS}' operator.`);

    error.data = queryObject;

    throw error;
  }

  if (operator === OPERATORS.IN) {
    return `${negated ? `${OPERATOR_NEGATOR} ` : ''}${parseValue(value)} ${operator} ${key}`;
  } else {
    return `${negated ? `${OPERATOR_NEGATOR} ` : ''}${key} ${operator} ${parseValue(value)}`;
  }
}

export function parseQueryArray(queryArray = [], group = false) {
  const parsedQuery = queryArray.map(q => parseQuery(q, false)).join(' ');

  return group ? `( ${parsedQuery} )` : parsedQuery;
}

export function parseQuery(query = [], top = true) {
  const queryType = query instanceof Array ? 'array' : typeof query;
  const parser = QUERY_TYPE_PARSER_MAP[queryType] || DEFAULT_QUERY_TYPE_PARSER;

  return parser(query, !top && queryType === QUERY_GROUP_TYPE);
}
