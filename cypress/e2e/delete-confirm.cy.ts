/// <reference types="cypress" />

describe('delete confirmation', () => {
  beforeEach(() => {
    cy.visit('/login')
    cy.get('[data-testid="login-email"]').clear().type('agent@exemple.com')
    cy.get('[data-testid="login-password"]').clear().type('motdepasse')
    cy.get('[data-testid="login-submit"]').click()
  })

  it('level delete requires confirmation and removes level + spaces on confirm', () => {
    const suffix = Date.now()

    cy.get('[data-testid="inspections-new"]', { timeout: 20000 }).click()
    cy.get('[data-testid="inspection-owner-name"]').type(`Delete Test ${suffix}`)
    cy.get('[data-testid="inspection-submit"]').click()

    cy.location('pathname', { timeout: 20000 }).should('match', /^\/inspections\/[^/]+/)

    cy.get('[data-testid="add-level"]').click()
    cy.get('[data-testid="new-level-name-input"]').type('Niveau à supprimer')
    cy.get('[data-testid="new-level-name-input"]').blur()
    cy.contains('[data-testid="level-label"]', 'Niveau à supprimer', { timeout: 10000 }).should('be.visible')

    cy.contains('[data-testid="level-label"]', 'Niveau à supprimer')
      .closest('[data-testid="level-section"]')
      .within(() => {
        cy.get('[data-testid="level-add-space"]').click()
      })
    cy.get('[data-testid="new-space-name-input"]').type('Espace test')
    cy.get('[data-testid="new-space-name-input"]').blur()
    cy.contains('[data-testid="space-name"]', 'Espace test', { timeout: 10000 }).should('be.visible')

    // Click delete — dialog should appear, level should NOT disappear yet
    cy.contains('[data-testid="level-label"]', 'Niveau à supprimer')
      .closest('[data-testid="level-section"]')
      .within(() => {
        cy.get('[data-testid="level-delete"]').click()
      })

    cy.get('[data-testid="level-delete-confirm"]', { timeout: 5000 }).should('be.visible')
    cy.contains('Niveau à supprimer').should('be.visible')

    // Confirm deletion
    cy.intercept('DELETE', '/levels/*').as('deleteLevel')
    cy.get('[data-testid="level-delete-confirm"]').click()
    cy.wait('@deleteLevel')

    cy.contains('Niveau à supprimer').should('not.exist')
    cy.contains('Espace test').should('not.exist')
  })

  it('cancelling level delete keeps the level intact', () => {
    const suffix = Date.now()

    cy.get('[data-testid="inspections-new"]', { timeout: 20000 }).click()
    cy.get('[data-testid="inspection-owner-name"]').type(`Cancel Test ${suffix}`)
    cy.get('[data-testid="inspection-submit"]').click()

    cy.location('pathname', { timeout: 20000 }).should('match', /^\/inspections\/[^/]+/)

    cy.get('[data-testid="add-level"]').click()
    cy.get('[data-testid="new-level-name-input"]').type('Niveau conservé')
    cy.get('[data-testid="new-level-name-input"]').blur()
    cy.contains('[data-testid="level-label"]', 'Niveau conservé', { timeout: 10000 }).should('be.visible')

    cy.contains('[data-testid="level-label"]', 'Niveau conservé')
      .closest('[data-testid="level-section"]')
      .within(() => {
        cy.get('[data-testid="level-delete"]').click()
      })

    cy.get('[data-testid="level-delete-confirm"]', { timeout: 5000 }).should('be.visible')

    // Cancel
    cy.contains('button', 'Annuler').click()

    cy.contains('Niveau conservé').should('be.visible')
  })
})
