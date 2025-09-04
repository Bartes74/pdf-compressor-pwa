// PDF Compressor PWA Service Worker
// Version: 1.0.0

// Cache configuration
const CACHE_NAME = 'pdf-compressor-v1.0.0';
const CACHE_LIMIT = 50 * 1024 * 1024; // 50MB limit

// Static assets to cache during installation
const STATIC_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './css/styles.css',
  './css/responsive.css',
  './js/app.js',
  './js/pdf-processor.js',
  './js/ui-controller.js',
  './js/storage-manager.js',
  './assets/icons/icon-72x72.png',
  './assets/icons/icon-96x96.png',
  './assets/icons/icon-128x128.png',
  './assets/icons/icon-144x144.png',
  './assets/icons/icon-152x152.png',
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-384x384.png',
  './assets/icons/icon-512x512.png'
];

// CDN libraries to cache at runtime
const CDN_LIBRARIES = [
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/build/pdf.min.js'
];

// Background sync tag
const SYNC_TAG = 'pdf-processing-sync';

// Install Event
// Strategy: Cache static assets during installation for offline availability
// Why: Ensures core application functionality works offline immediately after first visit
self.addEventListener('install', event => {
  console.log('[Service Worker] Install event');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Skip waiting to activate the new service worker immediately
        // Why: Ensures users get the latest features without waiting for tabs to close
        return self.skipWaiting();
      })
  );
});

// Activate Event
// Strategy: Clean up old caches and claim clients
// Why: Prevents accumulation of outdated cached data and takes control of all clients
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate event');
  
  event.waitUntil(
    // Clean up old caches
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old caches that don't match current cache name
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // Claim clients to take control immediately
      // Why: Ensures the service worker controls the page from the first load
      return self.clients.claim();
    })
  );
});

// Fetch Event
// Strategy: Different strategies based on resource type
// Why: Optimizes performance and user experience for different types of resources
self.addEventListener('fetch', event => {
  const { request } = event;
  
  // Ignore non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different types of requests with appropriate strategies
  if (isStaticAsset(request)) {
    // Strategy: Cache First for static assets
    // Why: Static assets don't change frequently, so caching provides fastest response
    event.respondWith(cacheFirstStrategy(request));
  } else if (isCDNLibrary(request)) {
    // Strategy: Stale While Revalidate for CDN libraries
    // Why: Ensures libraries are updated in background while serving cached version for speed
    event.respondWith(staleWhileRevalidateStrategy(request));
  } else if (isAPIRequest(request)) {
    // Strategy: Network First for API calls
    // Why: Ensures fresh data is retrieved when online, with fallback to cache when offline
    event.respondWith(networkFirstStrategy(request));
  } else {
    // Strategy: Cache First with Network Fallback for other requests
    // Why: Balances performance with data freshness
    event.respondWith(cacheFirstWithNetworkFallback(request));
  }
});

// Push Notification Event
// Strategy: Handle push notifications for processing completion
// Why: Keeps users informed about background operations
self.addEventListener('push', event => {
  console.log('[Service Worker] Push event received:', event);
  
  let title = 'PDF Compressor';
  let options = {
    body: 'Your PDF processing is complete!',
    icon: './assets/icons/icon-192x192.png',
    badge: './assets/icons/icon-72x72.png'
  };
  
  if (event.data) {
    const data = event.data.json();
    title = data.title || title;
    options.body = data.body || options.body;
    options.data = data;
  }
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Event
// Strategy: Handle notification clicks to open relevant pages
// Why: Improves user experience by directing them to relevant content
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click received');
  
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clientList => {
      // If there's an open client, focus it
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no client, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Background Sync Event
// Strategy: Process queued operations when connectivity is restored
// Why: Enables offline functionality with automatic synchronization
self.addEventListener('sync', event => {
  console.log('[Service Worker] Sync event:', event.tag);
  
  if (event.tag === SYNC_TAG) {
    event.waitUntil(processSyncQueue());
  }
});

// Helper Functions

// Determine if request is for a static asset
function isStaticAsset(request) {
  const url = new URL(request.url);
  return STATIC_ASSETS.includes(url.pathname) || 
         url.pathname.startsWith('/assets/') ||
         url.pathname.endsWith('.css') || 
         url.pathname.endsWith('.js');
}

// Determine if request is for a CDN library
function isCDNLibrary(request) {
  const url = new URL(request.url);
  return CDN_LIBRARIES.some(cdnUrl => request.url.startsWith(cdnUrl));
}

// Determine if request is for an API call
function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/') || 
         url.hostname.includes('api.') ||
         request.headers.get('Content-Type') === 'application/json';
}

// Cache First Strategy
// Used for: Static assets that don't change frequently
// Why: Provides fastest response time for unchanging resources
async function cacheFirstStrategy(request) {
  try {
    // Try to get response from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    // Cache the response for future requests
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, networkResponse.clone());
    
    // Check cache size and manage if needed
    await manageCacheSize();
    
    return networkResponse;
  } catch (error) {
    // If both cache and network fail, return offline fallback
    return getOfflineFallback(request);
  }
}

// Stale While Revalidate Strategy
// Used for: CDN libraries that should be updated but can be served from cache initially
// Why: Provides immediate response while updating cache in background
async function staleWhileRevalidateStrategy(request) {
  try {
    // Try to get response from cache
    const cachedResponse = await caches.match(request);
    
    // Fetch fresh response from network in background
    const networkResponsePromise = fetch(request).then(async response => {
      // Update cache with fresh response
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
      
      // Check cache size and manage if needed
      await manageCacheSize();
      
      return response;
    });
    
    // Return cached response if available, otherwise wait for network
    return cachedResponse || networkResponsePromise;
  } catch (error) {
    // If both fail, return offline fallback
    return getOfflineFallback(request);
  }
}

// Network First Strategy
// Used for: API requests that need fresh data
// Why: Ensures users get the most current data when online
async function networkFirstStrategy(request) {
  try {
    // Try to fetch from network
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
      
      // Check cache size and manage if needed
      await manageCacheSize();
    }
    
    return networkResponse;
  } catch (error) {
    // If network fails, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If both fail, return offline fallback
    return getOfflineFallback(request);
  }
}

// Cache First with Network Fallback Strategy
// Used for: General requests when specific strategy isn't defined
// Why: Balances performance with data freshness
async function cacheFirstWithNetworkFallback(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    // Cache the response
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, networkResponse.clone());
    
    // Check cache size and manage if needed
    await manageCacheSize();
    
    return networkResponse;
  } catch (error) {
    // If both fail, return offline fallback
    return getOfflineFallback(request);
  }
}

// Get offline fallback response
// Used for: Providing offline experience when resources are unavailable
// Why: Ensures graceful degradation of functionality when offline
async function getOfflineFallback(request) {
  // For navigation requests, return offline.html
  if (request.mode === 'navigate') {
    const cache = await caches.open(CACHE_NAME);
    return cache.match('./offline.html');
  }
  
  // For image requests, return a placeholder
  if (request.destination === 'image') {
    return new Response('', {
      status: 404,
      statusText: 'Not Found',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  // For other requests, return a generic offline response
  return new Response('Offline content', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain' }
  });
}

// Manage cache size to stay within limits
// Used for: Preventing cache from growing too large
// Why: Ensures application doesn't consume excessive storage
async function manageCacheSize() {
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  
  // Calculate total cache size
  let totalSize = 0;
  const cacheData = [];
  
  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const clonedResponse = response.clone();
      const blob = await clonedResponse.blob();
      const size = blob.size;
      totalSize += size;
      cacheData.push({ request, size, timestamp: Date.now() });
    }
  }
  
  // If cache exceeds limit, remove oldest entries
  if (totalSize > CACHE_LIMIT) {
    // Sort by timestamp (oldest first)
    cacheData.sort((a, b) => a.timestamp - b.timestamp);
    
    // Remove oldest entries until under limit
    let removedSize = 0;
    for (const data of cacheData) {
      if (totalSize - removedSize <= CACHE_LIMIT * 0.8) break; // Leave some buffer
      
      await cache.delete(data.request);
      removedSize += data.size;
      console.log('[Service Worker] Removed cached item:', data.request.url);
    }
    
    console.log(`[Service Worker] Removed ${removedSize} bytes from cache`);
  }
}

// Process background sync queue
// Used for: Handling queued operations when connectivity is restored
// Why: Enables offline functionality with automatic synchronization
async function processSyncQueue() {
  console.log('[Service Worker] Processing sync queue');
  
  // In a real implementation, this would process queued PDF operations
  // For this example, we'll just show a notification
  
  const clients = await self.clients.matchAll({ type: 'window' });
  if (clients.length > 0) {
    // Send message to client that sync is complete
    clients[0].postMessage({ type: 'SYNC_COMPLETE' });
  } else {
    // Show notification if no clients are open
    const title = 'PDF Processing Complete';
    const options = {
      body: 'Your queued PDF operations have been processed.',
      icon: './assets/icons/icon-192x192.png',
      badge: './assets/icons/icon-72x72.png'
    };
    
    return self.registration.showNotification(title, options);
  }
}

// Listen for messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});