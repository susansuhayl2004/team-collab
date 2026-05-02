'use strict';

/**
 * @fileoverview Reusable input validation helpers used across API routes.
 * All validators return `null` on success or an error message string on failure,
 * making them easy to compose without throwing.
 * @module utils/validate
 */

const { ValidationError } = require('./errors');

/**
 * Validates that a string field is present, non-empty, and within a max length.
 * @param {*}      value     - The value to validate
 * @param {string} fieldName - Human-readable field name for error messages
 * @param {number} [maxLen=255] - Maximum allowed character length
 * @returns {string|null} Error message, or null if valid
 */
function validateRequiredString(value, fieldName, maxLen = 255) {
  if (value === undefined || value === null || value === '') {
    return `${fieldName} is required`;
  }
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  if (value.trim().length === 0) {
    return `${fieldName} cannot be blank`;
  }
  if (value.trim().length > maxLen) {
    return `${fieldName} must be ${maxLen} characters or fewer`;
  }
  return null;
}

/**
 * Validates that a value, if present, is one of the allowed enum values.
 * @param {*}        value      - The value to validate (may be undefined)
 * @param {string}   fieldName  - Human-readable field name
 * @param {string[]} allowedValues - Accepted values
 * @returns {string|null} Error message, or null if valid / not present
 */
function validateEnum(value, fieldName, allowedValues) {
  if (value === undefined) { return null; }
  if (!allowedValues.includes(value)) {
    return `${fieldName} must be one of: ${allowedValues.join(', ')}`;
  }
  return null;
}

/**
 * Validates an email address using a simple RFC-compliant pattern.
 * @param {string} email
 * @returns {string|null} Error message, or null if valid
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return 'Email is required';
  }
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!pattern.test(email.trim())) {
    return 'Email address is invalid';
  }
  return null;
}

/**
 * Runs multiple validators and throws a ValidationError with the first
 * failure found. Makes route handlers concise.
 * @param {...(string|null)} errors - Results from individual validators
 * @throws {ValidationError} On the first non-null error
 * @example
 * assertValid(
 *   validateRequiredString(req.body.name, 'Name', 100),
 *   validateEmail(req.body.email)
 * );
 */
function assertValid(...errors) {
  for (const err of errors) {
    if (err !== null) {
      throw new ValidationError(err);
    }
  }
}

/**
 * Sanitises a string by trimming whitespace.
 * Returns an empty string if the input is nullish.
 * @param {*} value
 * @returns {string}
 */
function sanitiseString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

module.exports = {
  validateRequiredString,
  validateEnum,
  validateEmail,
  assertValid,
  sanitiseString,
};
