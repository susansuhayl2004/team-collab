'use strict';

/**
 * @fileoverview Custom error classes for structured, consistent error handling
 * across all API routes. Each class maps to a specific HTTP status code.
 * @module utils/errors
 */

/**
 * Base application error class. Extends native Error with HTTP status
 * and a machine-readable error code for API consumers.
 * @extends Error
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error description
   * @param {number} statusCode - HTTP status code (default 500)
   * @param {string} code - Machine-readable error code
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // distinguishes from programmer errors
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request — invalid or missing input from the client.
 * @extends AppError
 */
class ValidationError extends AppError {
  /**
   * @param {string} message - Validation failure description
   */
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

/**
 * 401 Unauthorized — authentication is required but missing.
 * @extends AppError
 */
class AuthenticationError extends AppError {
  /**
   * @param {string} [message='Authentication required']
   */
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * 403 Forbidden — authenticated but lacks permission.
 * @extends AppError
 */
class ForbiddenError extends AppError {
  /**
   * @param {string} [message='Access denied']
   */
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * 404 Not Found — requested resource does not exist.
 * @extends AppError
 */
class NotFoundError extends AppError {
  /**
   * @param {string} [message='Resource not found']
   */
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * 409 Conflict — resource state conflict (e.g. duplicate).
 * @extends AppError
 */
class ConflictError extends AppError {
  /**
   * @param {string} message - Conflict description
   */
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * 503 Service Unavailable — downstream dependency not available.
 * @extends AppError
 */
class ServiceUnavailableError extends AppError {
  /**
   * @param {string} [message='Service temporarily unavailable']
   */
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
};
