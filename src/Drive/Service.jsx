import {CONJUNCTIONS, OPERATORS, parseQuery} from './QueryUtils';
import GoogleDriveMediaUploader from './Upload/GoogleDriveMediaUploader';

export default class Service {
  static DEFAULT_PAGE_SIZE = 100;
  static FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
  static DEFAULT_MIME_TYPE = 'application/octet-stream';
  static JSON_MIME_TYPE = 'application/json';
  static ROOT_FOLDER = 'root';
  static APPLICATION_DATA_FOLDER = 'appDataFolder';
  static ALT_TYPES = {
    MEDIA: 'media',
    JSON: 'json'
  };

  static parseFields(fields = {}) {
    return Object
      .keys(fields)
      .map(k => {
        const value = fields[k];

        if (value instanceof Object) {
          return `${k}(${Service.parseFields(value)})`;
        } else {
          return k;
        }
      })
      .join(', ');
  }

  static convertResponse(resolve) {
    return ({result} = {}) => {
      resolve(result);
    };
  }

  static getCleanContentArray(content, mimeType = Service.DEFAULT_MIME_TYPE) {
    let cleanContentArray = [];

    if (typeof content !== 'undefined' && content !== null && content !== '') {
      const stringContent = mimeType === Service.JSON_MIME_TYPE ?
        JSON.stringify(content, null, 2) :
        content;

      cleanContentArray = [
        stringContent
      ];
    }

    return cleanContentArray;
  }

  uploadChunkSize = 20 * 1000 * 1000;

  authToken;
  drive;

  constructor(config = {}) {
    Object.assign(this, config);
  }

  /**
   * Create a new file.
   * @param {Object} file
   * @param {string} file.name
   * @param {string} file.mimeType
   * @param {Object} file.properties
   * @param {*} file.content
   * @param {string} folder
   * */
  async create(
    {
      name = '',
      mimeType = Service.DEFAULT_MIME_TYPE,
      properties,
      content
    } = {},
    folder = Service.ROOT_FOLDER
  ) {
    const newFile = await new Promise((res, rej) => {
      this.drive.files.create({
        name,
        mimeType,
        properties,
        parents: typeof folder === 'string' && folder !== '' ?
          [
            folder
          ] :
          undefined
      })
        .then(Service.convertResponse(res), rej);
    });
    const {id} = newFile;

    if (typeof content !== 'undefined') {
      const cleanContentArray = Service.getCleanContentArray(content, mimeType);

      await GoogleDriveMediaUploader.uploadAsync({
        token: this.authToken,
        file: new Blob(
          cleanContentArray,
          {
            type: mimeType
          }
        ),
        chunkSize: this.uploadChunkSize,
        contentType: mimeType,
        fileId: id
      });
    }

    return {
      id,
      name,
      mimeType,
      properties,
      content
    };
  }

  /**
   * Read a detailed file.
   * @param {string} id
   * @param {boolean} infoOnly
   * */
  async read(id = '', infoOnly = false) {
    const file = await new Promise((res, rej) => {
      this.drive.files.get({
        fileId: id,
        fields: 'id, name, mimeType, properties, description, parents'
      })
        .then(Service.convertResponse(res), rej);
    });
    const {mimeType} = file;
    const isFolder = mimeType === Service.FOLDER_MIME_TYPE;

    let content;

    if (!infoOnly && !isFolder) {
      const rawContent = await new Promise((res, rej) => {
        this.drive.files.get({
          fileId: id,
          alt: Service.ALT_TYPES.MEDIA
        })
          .then(Service.convertResponse(res), rej);
      });

      content = mimeType === Service.JSON_MIME_TYPE && typeof rawContent === 'string' ?
        JSON.parse(rawContent) :
        rawContent;
    }

    return {
      ...file,
      content
    };
  }

  /**
   * Update a file.
   * @param {Object} file
   * @param {string} file.id
   * @param {string} file.name
   * @param {string} file.mimeType
   * @param {*} file.content
   * */
  async update({id = '', name = '', mimeType = Service.DEFAULT_MIME_TYPE, content} = {}) {
    await new Promise((res, rej) => {
      this.drive.files.update({
        fileId: id,
        resource: {
          name,
          mimeType,
        }
      })
        .then(Service.convertResponse(res), rej);
    });

    if (typeof content !== 'undefined') {
      const cleanContentArray = Service.getCleanContentArray(content, mimeType);

      await GoogleDriveMediaUploader.uploadAsync({
        token: this.authToken,
        file: new Blob(
          cleanContentArray,
          {
            type: mimeType
          }
        ),
        chunkSize: this.uploadChunkSize,
        contentType: mimeType,
        fileId: id
      });
    }

    return {
      id,
      name,
      mimeType,
      content
    };
  }

  /**
   * Delete a file.
   * @param {string} id
   * */
  async delete(id = '') {
    await new Promise((res, rej) => {
      this.drive.files.delete({
        fileId: id
      })
        .then(Service.convertResponse(res), rej);
    });

    return true;
  }

  /**
   * Add a file to a folder, optionally removing it from another or all other folders.
   * @param {Object} config
   * @param {string} config.id
   * @param {string} config.folder
   * @param {string} config.moveFromFolder
   * @param {boolean} config.removeFromAllOtherFolders
   * */
  async addToFolder({id = '', folder = '', moveFromFolder, removeFromAllOtherFolders = false} = {}) {
    let newParents;

    if (removeFromAllOtherFolders) {
      newParents = [
        folder
      ];
    } else {
      const moving = typeof moveFromFolder === 'string' && moveFromFolder !== '';
      const {parents = []} = await this.read(id, true);

      newParents = moving ?
        [
          ...parents,
          folder
        ] :
        [
          ...parents
        ]
          .map(p => p === moveFromFolder ? folder : p);
    }

    await new Promise((res, rej) => {
      this.drive.files.update({
        fileId: id,
        resource: {
          parents: newParents
        }
      })
        .then(Service.convertResponse(res), rej);
    });

    return true;
  }

  /**
   * List files in a folder.
   * @param {Object} config
   * @param {string} config.folder
   * @param {string} config.mimeType
   * @param {string} config.fileExtension
   * @param {number} config.pageSize
   * @param {string} config.pageToken
   * @param {Array} config.orderBy
   * @param {Object} config.fields
   * */
  async list({
               folder = Service.ROOT_FOLDER,
               mimeType,
               fileExtension,
               pageSize = Service.DEFAULT_PAGE_SIZE,
               pageToken,
               orderBy,
               fields
             } = {}) {
    const listByMimeType = typeof mimeType === 'string' && mimeType !== '';
    const listByFileExtension = typeof fileExtension === 'string' && fileExtension !== '';

    let cleanMimeType;

    if (listByMimeType) {
      cleanMimeType = mimeType.split('*').join('');
    }

    return this.search({
      pageToken,
      pageSize,
      orderBy: orderBy || [
        'folder',
        'name_natural'
      ],
      fields: fields || {
        nextPageToken: true,
        files: {
          id: true,
          name: true,
          parents: true,
          mimeType: true,
          thumbnailLink: true,
          webViewLink: true
        }
      },
      query: listByMimeType ?
        [
          {
            key: 'parents',
            operator: OPERATORS.IN,
            value: folder
          },
          CONJUNCTIONS.AND,
          [
            {
              key: 'mimeType',
              operator: OPERATORS.EQUALS,
              value: Service.FOLDER_MIME_TYPE
            },
            CONJUNCTIONS.OR,
            {
              key: 'mimeType',
              operator: OPERATORS.CONTAINS,
              value: cleanMimeType
            }
          ]
        ] :
        listByFileExtension ?
          [
            {
              key: 'parents',
              operator: OPERATORS.IN,
              value: folder
            },
            CONJUNCTIONS.AND,
            [
              {
                key: 'mimeType',
                operator: OPERATORS.EQUALS,
                value: Service.FOLDER_MIME_TYPE
              },
              CONJUNCTIONS.OR,
              {
                key: 'fileExtension',
                operator: OPERATORS.EQUALS,
                value: fileExtension
              }
            ]
          ] :
          [
            {
              key: 'parents',
              operator: OPERATORS.IN,
              value: folder
            }
          ]
    });
  }

  /**
   * Search for files.
   * @param {Object} config
   * @param {Array} config.query
   * @param {Object} config.fields
   * @param {string} config.pageToken
   * @param {number} config.pageSize
   * @param {Array} config.orderBy
   * */
  async search({
                 query = [],
                 fields = {},
                 pageToken,
                 pageSize = Service.DEFAULT_PAGE_SIZE,
                 orderBy = []
               } = {}) {
    return new Promise((res, rej) => {
      this.drive.files.list({
        pageToken,
        q: parseQuery(query),
        fields: Service.parseFields(fields),
        orderBy: orderBy.join(','),
        pageSize
      })
        .then(Service.convertResponse(res), rej);
    });
  }
}
