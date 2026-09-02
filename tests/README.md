# Test Suite for Omni-Channel Platform

> Live product tests should hit `src/server.js` (health, conversations, LINE/WhatsApp webhooks). Pipeline tests in `src/core/` do not prove the dashboard works. See [TESTING_GUIDE.md](../TESTING_GUIDE.md) and [README.md](../README.md).

## Overview
This test suite provides unit tests for critical security functions of the Omni-Channel Platform.

## Test Coverage

### ✅ Implemented Tests

1. **JWT Authentication Tests** (`security.test.js`)
   - Token validation
   - Token rejection for invalid tokens
   - Token rejection for missing tokens

2. **Optional Authentication Tests**
   - Anonymous user access
   - Guest role assignment

3. **Role Authorization Tests**
   - Permission checking
   - Role-based access control

4. **Webhook Validation Tests**
   - LINE signature validation
   - Invalid signature rejection

5. **Input Validation Tests**
   - XSS prevention
   - Message length validation

6. **Rate Limiting Tests**
   - Request counting
   - Rate limit enforcement

7. **Audit Logging Tests**
   - Security event logging

## Running Tests

```bash
# Install test dependencies
npm install --save-dev jest @jest/globals

# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

## Test Structure

```
tests/
├── unit/
│   └── security.test.js    # Security function tests
├── integration/             # Integration tests (TODO)
└── README.md                # This file
```

## Configuration

Tests use the following environment variables:

```env
NODE_ENV=test
JWT_SECRET=test_secret_key_minimum_32_characters_long_for_jwt_authentication
LINE_CHANNEL_SECRET=test_line_secret
```

## Adding New Tests

To add new tests:

1. Create a new test file in `tests/unit/` directory
2. Follow the existing test structure
3. Use Jest's test framework
4. Update this README with new test categories

## Coverage Goals

- **Unit Tests**: 60%+ coverage for security-critical functions
- **Integration Tests**: Core webhook and API endpoint testing
- **E2E Tests**: Full system workflow testing

## TODO

- [ ] Add webhook handler integration tests
- [ ] Add Socket.IO authentication tests
- [ ] Add rate limiting integration tests
- [ ] Add database operation tests
- [ ] Add message processing pipeline tests


