import expect from 'expect.js';
import {
  CONJUNCTIONS,
  OPERATORS,
  parseQuery
} from './QueryUtils';

export default {
  QueryUtils: {
    parseQuery: {
      'should create a proper query': () => {
        const parsedQueryString = parseQuery([
          {
            key: 'properties',
            operator: OPERATORS.HAS,
            value: [
              {
                key: 'CENTRAL_HOME_ITEM_TYPE',
                value: 'ITEM'
              },
              CONJUNCTIONS.AND,
              {
                negated: true,
                key: 'HIDDEN',
                value: true
              }
            ]
          },
          CONJUNCTIONS.OR,
          {
            key: 'name',
            operator: OPERATORS.CONTAINS,
            value: 'Project'
          },
          CONJUNCTIONS.AND,
          [
            {
              key: 'mimeType',
              value: 'image/png'
            },
            CONJUNCTIONS.OR,
            {
              key: 'mimeType',
              value: 'image/svg'
            }
          ]
        ]);
        const targetQueryString = `properties has { key='CENTRAL_HOME_ITEM_TYPE' and value='ITEM' and key='HIDDEN' and not value=true } or name contains 'Project' and ( mimeType = 'image/png' or mimeType = 'image/svg' )`;

        expect(parsedQueryString).to.equal(targetQueryString);
      }
    }
  }
};
