const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    viewportWidth: 390,
    viewportHeight: 844,
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    defaultCommandTimeout: 15000,
    video: false,
    setupNodeEvents(on, config) {
      return config
    },
  },
})
