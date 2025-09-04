module.exports = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: [
      'performance',
      'accessibility',
      'best-practices',
      'seo',
      'pwa'
    ],
    // Emulate a mobile device
    emulatedFormFactor: 'mobile',
    // Use a simulated connection
    throttlingMethod: 'simulate',
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4
    },
    // Audit settings
    maxWaitForFcp: 15000,
    maxWaitForLoad: 35000,
    skipAudits: [
      // Skip audits that are not relevant for a PWA
      'uses-http2',
      'uses-long-cache-ttl'
    ]
  },
  // Custom performance budgets
  budgets: [
    {
      "resourceCounts": [
        {"resourceType": "script", "budget": 10},
        {"resourceType": "stylesheet", "budget": 5},
        {"resourceType": "image", "budget": 10},
        {"resourceType": "font", "budget": 3},
        {"resourceType": "document", "budget": 1},
        {"resourceType": "other", "budget": 5},
        {"resourceType": "third-party", "budget": 10}
      ],
      "resourceSizes": [
        {"resourceType": "script", "budget": 100},
        {"resourceType": "stylesheet", "budget": 50},
        {"resourceType": "image", "budget": 100},
        {"resourceType": "font", "budget": 50},
        {"resourceType": "document", "budget": 20},
        {"resourceType": "other", "budget": 50},
        {"resourceType": "total", "budget": 300}
      ]
    }
  ]
};