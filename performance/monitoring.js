// Performance monitoring and analytics setup

// Google Analytics 4 setup
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

// Configure GA4 with your measurement ID
// gtag('config', 'G-XXXXXXXXXX');

// Web Vitals reporting
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  // Replace with your analytics endpoint
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    navigationType: metric.navigationType,
    url: window.location.href,
    timestamp: new Date().toISOString()
  });

  // Send to your analytics service
  // navigator.sendBeacon('/analytics', body);
  
  // For development, log to console
  console.log('Web Vitals Metric:', body);
}

// Report all available metrics
getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);

// Error tracking with Sentry-like functionality
class ErrorTracker {
  constructor() {
    this.errors = [];
    this.init();
  }

  init() {
    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.captureError({
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack || 'No stack trace'
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        message: event.reason?.message || event.reason,
        stack: event.reason?.stack || 'No stack trace',
        type: 'unhandledrejection'
      });
    });
  }

  captureError(error) {
    const errorData = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...error
    };

    this.errors.push(errorData);
    
    // In production, send to your error tracking service
    // fetch('/api/errors', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(errorData)
    // });
    
    // For development, log to console
    console.error('Captured Error:', errorData);
  }

  getErrors() {
    return this.errors;
  }
}

// Initialize error tracking
const errorTracker = new ErrorTracker();

// Export for use in other modules
export { errorTracker };

// Performance monitoring utilities
export class PerformanceMonitor {
  static measureLoadTime() {
    window.addEventListener('load', () => {
      const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
      console.log(`Page Load Time: ${loadTime}ms`);
      
      // Send to analytics
      if (typeof gtag !== 'undefined') {
        gtag('event', 'timing_complete', {
          name: 'load',
          value: loadTime,
          event_category: 'Performance'
        });
      }
    });
  }

  static measureFCP() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          console.log(`First Contentful Paint: ${entry.startTime}ms`);
          
          // Send to analytics
          if (typeof gtag !== 'undefined') {
            gtag('event', 'timing_complete', {
              name: 'fcp',
              value: Math.round(entry.startTime),
              event_category: 'Performance'
            });
          }
        }
      }
    });
    
    observer.observe({ entryTypes: ['paint'] });
  }
}

// Start monitoring when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    PerformanceMonitor.measureLoadTime();
    PerformanceMonitor.measureFCP();
  });
} else {
  PerformanceMonitor.measureLoadTime();
  PerformanceMonitor.measureFCP();
}