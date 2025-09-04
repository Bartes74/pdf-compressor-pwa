# PDF Compressor PWA

A Progressive Web App for compressing PDF files locally in your browser without uploading them to any server.

## Features

- Compress PDF files directly in your browser
- No server uploads required - all processing happens locally
- Progressive Web App support - installable on mobile and desktop
- Offline functionality after initial visit
- Responsive design that works on all devices
- Three compression levels: Low, Medium, and High

## Project Structure

```
/pdf-compressor-pwa
  /src
    /js
      - app.js (main application logic)
      - pdf-processor.js (PDF processing functionality)
      - ui-controller.js (UI interaction handling)
      - storage-manager.js (cache and IndexedDB management)
      - pdf-worker.js (Web Worker for PDF processing)
    /css
      - styles.css (main styles)
      - responsive.css (responsive design styles)
    /assets
      /icons (PWA icons in various sizes)
    /tests
      - pdf-processor.test.js (unit tests for PDF processing)
      - storage-manager.test.js (unit tests for storage management)
      - ui-controller.test.js (unit tests for UI controller)
      - setupTests.js (Jest test environment setup)
  /public
    - index.html (main HTML file)
    - manifest.json (PWA manifest)
    - service-worker.js (service worker for offline support)
    - offline.html (offline fallback page)
  /e2e
    /tests
      - upload-flow.test.js (Playwright upload tests)
      - processing-flow.test.js (Playwright processing tests)
      - download-flow.test.js (Playwright download tests)
      - offline-mode.test.js (Playwright offline tests)
  /performance
    - bundle-size.test.js (bundle size validation)
    - lighthouse.config.js (Lighthouse audit configuration)
    - monitoring.js (performance and error monitoring)
  /.github/workflows
    - deploy.yml (GitHub Actions deployment workflow)
  - package.json
  - webpack.config.js
  - Dockerfile
  - nginx.conf
  - netlify.toml
  - vercel.json
  - SECURITY.md
  - PWA_DEPLOYMENT_CHECKLIST.md
  - README.md
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Development

To start the development server:
```bash
npm start
```

To build for production:
```bash
npm run build
```

## Testing

### Unit Tests

Run unit tests with Jest:
```bash
npm test
```

Run unit tests in watch mode:
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

### E2E Tests

Run end-to-end tests with Playwright:
```bash
npm run e2e
```

Run E2E tests with UI:
```bash
npm run e2e:ui
```

### Performance Tests

Run Lighthouse audit:
```bash
npm run perf
```

Run bundle size validation:
```bash
npm run test:bundle
```

## Deployment

### GitHub Pages

The project includes a GitHub Actions workflow for automatic deployment to GitHub Pages:

1. Fork the repository
2. Enable GitHub Pages in repository settings
3. Push to the `main` branch
4. The workflow will automatically build and deploy

### Netlify

Deploy to Netlify:

1. Connect your GitHub repository to Netlify
2. Set build command to: `npm run build`
3. Set publish directory to: `dist`
4. Deploy!

Alternatively, use the Netlify CLI:
```bash
npm install -g netlify-cli
netlify deploy
```

### Vercel

Deploy to Vercel:

1. Connect your GitHub repository to Vercel
2. Import the project
3. Vercel will automatically detect the build settings
4. Deploy!

Alternatively, use the Vercel CLI:
```bash
npm install -g vercel
vercel
```

### Docker

Build and run with Docker:

```bash
# Build the image
docker build -t pdf-compressor-pwa .

# Run the container
docker run -d -p 8080:80 pdf-compressor-pwa
```

The application will be available at http://localhost:8080

## Security

This application implements several security measures:

- Content Security Policy (CSP)
- X-Frame-Options header
- X-Content-Type-Options header
- Referrer-Policy header

See [SECURITY.md](SECURITY.md) for detailed information.

## Performance Monitoring

The application includes performance monitoring for:

- Core Web Vitals (LCP, FID, CLS)
- Custom performance metrics
- Error tracking

See [performance/monitoring.js](performance/monitoring.js) for implementation details.

## PWA Deployment Checklist

Before deploying, ensure all requirements are met using the [PWA_DEPLOYMENT_CHECKLIST.md](PWA_DEPLOYMENT_CHECKLIST.md).

## Technologies Used

- [pdf-lib](https://pdf-lib.js.org/) - For PDF processing
- [pdfjs-dist](https://mozilla.github.io/pdf.js/) - For PDF rendering
- Webpack - For bundling
- Workbox - For service worker generation
- Jest - For unit testing
- Playwright - For E2E testing
- Lighthouse - For performance auditing
- HTML5, CSS3, JavaScript (ES6+)

## How It Works

1. User selects or drops a PDF file
2. The file is processed locally using pdf-lib
3. Compression is applied based on selected level
4. Compressed file is made available for download
5. All operations happen in the browser - no data is sent to any server

## Browser Support

This PWA works in all modern browsers that support:
- Service Workers
- IndexedDB
- File API
- Canvas
- Web Workers

Tested browsers:
- Chrome 80+
- Firefox 74+
- Safari 11.1+
- Edge 80+

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Add tests if applicable
5. Run the test suite:
   ```bash
   npm test
   npm run e2e
   npm run perf
   ```
6. Commit your changes:
   ```bash
   git commit -m "Add your feature description"
   ```
7. Push to the branch:
   ```bash
   git push origin feature/your-feature-name
   ```
8. Open a pull request

### Code Style

- Follow the existing code style
- Use ESLint and Prettier for code formatting
- Write unit tests for new functionality
- Ensure all tests pass before submitting a PR

### Commit Messages

Follow conventional commit format:
- `feat: Add new feature`
- `fix: Fix bug in PDF processing`
- `docs: Update README`
- `test: Add unit tests`
- `chore: Update dependencies`

## License

MIT License - see [LICENSE](LICENSE) file for details