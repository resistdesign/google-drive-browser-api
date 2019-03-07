import RetryHandler from './RetryHandler';

const NOOP = () => {
};

export default class GoogleDriveMediaUploader {
  static DEFAULTS = {
    MIME_TYPE: 'application/octet-stream',
    UPLOAD_TYPE: 'resumable',
    BASE_URL: 'https://www.googleapis.com/upload/drive/v3/files/'
  };
  static HTTP_METHODS = {
    PUT: 'PUT',
    POST: 'POST',
    PATCH: 'PATCH'
  };

  static buildQuery (params) {
    params = params || {};
    return Object.keys(params).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    }).join('&');
  }

  static buildUrl (id, params, baseUrl) {
    let url = baseUrl || GoogleDriveMediaUploader.DEFAULTS.BASE_URL;
    if (id) {
      url += id;
    }
    const query = GoogleDriveMediaUploader.buildQuery(params);
    if (query) {
      url += '?' + query;
    }
    return url;
  }

  static uploadAsync = async (options = {}) => {
    const internalOptions = { ...options };

    return new Promise(function (resolve, reject) {
      internalOptions.onComplete = function (r) {
        let response;
        try {
          response = (typeof r === 'string') ?
            JSON.parse(r) :
            r;
        } catch (e) {
          response = r;
        }
        resolve(response);
      };
      internalOptions.onError = function (e) {
        reject(e);
      };
      const uploader = new GoogleDriveMediaUploader(internalOptions);
      uploader.upload();
    });
  };

  token;
  file;
  contentType;
  metadata;
  onComplete;
  onProgress;
  onError;
  offset;
  chunkSize;
  retryHandler;
  httpMethod;
  url;

  /**
   * @param {object} options Hash of options
   * @param {string} options.token Access token
   * @param {blob} options.file Blob-like item to upload
   * @param {string} [options.fileId] ID of file if replacing
   * @param {object} [options.params] Additional query parameters
   * @param {string} [options.contentType] Content-type, if overriding the type of the blob.
   * @param {object} [options.metadata] File metadata
   * @param {function} [options.onComplete] Callback for when upload is complete
   * @param {function} [options.onProgress] Callback for status for the in-progress upload
   * @param {function} [options.onError] Callback if upload fails
   * */
  constructor (options = {}) {
    const {
      token,
      file,
      contentType,
      metadata,
      onComplete,
      onProgress,
      onError,
      offset,
      chunkSize,
      url,
      params,
      fileId,
      baseUrl
    } = options;

    if (!token) {
      throw new Error('token is required.');
    }

    this.token = token;
    this.file = file;
    this.contentType = contentType ||
      this.file.type ||
      GoogleDriveMediaUploader.DEFAULTS.MIME_TYPE;
    this.metadata = metadata || {
      name: this.file.name,
      mimeType: this.contentType
    };
    this.onComplete = onComplete || NOOP;
    this.onProgress = onProgress || NOOP;
    this.onError = onError || NOOP;
    this.offset = offset || 0;
    this.chunkSize = chunkSize || 0;
    this.retryHandler = new RetryHandler();
    this.httpMethod = fileId ?
      GoogleDriveMediaUploader.HTTP_METHODS.PATCH :
      GoogleDriveMediaUploader.HTTP_METHODS.POST;
    this.url = url;

    if (!this.url) {
      const params = params || {};
      params.uploadType = GoogleDriveMediaUploader.DEFAULTS.UPLOAD_TYPE;
      this.url = GoogleDriveMediaUploader.buildUrl(fileId, params, baseUrl);
    }
  }

  upload () {
    const xhr = new XMLHttpRequest();

    xhr.open(this.httpMethod, this.url, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + this.token);
    xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
    xhr.setRequestHeader('X-Upload-Content-Length', this.file.size);
    xhr.setRequestHeader('X-Upload-Content-Type', this.contentType);

    xhr.onload = (e) => {
      if (e.target.status < 400) {
        this.url = e.target.getResponseHeader('Location');
        this.sendFile();
      } else {
        this.onUploadError(e);
      }
    };
    xhr.onerror = this.onUploadError;
    xhr.send(JSON.stringify(this.metadata));
  }

  sendFile () {
    let content = this.file;
    let end = this.file.size;

    if (this.offset || this.chunkSize) {
      // Only bother to slice the file if we're either resuming or uploading in chunks
      if (this.chunkSize) {
        end = Math.min(this.offset + this.chunkSize, this.file.size);
      }
      content = content.slice(this.offset, end);
    }

    const xhr = new XMLHttpRequest();
    xhr.open(
      GoogleDriveMediaUploader.HTTP_METHODS.PUT,
      this.url,
      true
    );
    xhr.setRequestHeader('Content-Type', this.contentType);
    xhr.setRequestHeader('Content-Range', 'bytes ' + this.offset + '-' + (end - 1) + '/' + this.file.size);
    xhr.setRequestHeader('X-Upload-Content-Type', this.file.type);
    if (xhr.upload) {
      xhr.upload.addEventListener('progress', this.onProgress);
    }
    xhr.onload = this.onContentUploadSuccess;
    xhr.onerror = this.onContentUploadError;
    xhr.send(content);
  }

  resume = () => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', this.url, true);
    xhr.setRequestHeader('Content-Range', 'bytes */' + this.file.size);
    xhr.setRequestHeader('X-Upload-Content-Type', this.file.type);
    if (xhr.upload) {
      xhr.upload.addEventListener('progress', this.onProgress);
    }
    xhr.onload = this.onContentUploadSuccess;
    xhr.onerror = this.onContentUploadError;
    xhr.send();
  };

  extractRange (xhr) {
    const range = xhr.getResponseHeader('Range');
    if (range) {
      this.offset = parseInt(range.match(/\d+/g).pop(), 10) + 1;
    }
  }

  onContentUploadSuccess = (e) => {
    if (e.target.status === 200 || e.target.status === 201) {
      this.onComplete(e.target.response);
    } else if (e.target.status === 308) {
      this.extractRange(e.target);
      this.retryHandler.reset();
      this.sendFile();
    } else {
      this.onContentUploadError(e);
    }
  };

  onContentUploadError = (e) => {
    if (e.target.status && e.target.status < 500) {
      this.onError(e.target.response);
    } else {
      this.retryHandler.retry(this.resume);
    }
  };

  onUploadError = (e) => {
    this.onError(e.target.response);
  };
}
