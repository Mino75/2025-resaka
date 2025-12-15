# Resaka - Browser-Based LLM Chat

A progressive web app that runs Large Language Models directly in your browser using WebLLM, with offline support and intelligent caching strategies.

## 🌟 Features

- **Browser-Based LLM Execution**: Run language models directly in your browser using WebGPU
- **Multiple Context Modes**: Switch between specialized conversation contexts (General, Encyclopedia, Programming, Cooking, etc.)
- **Offline-First Architecture**: Works offline once cached, with intelligent service worker caching
- **Progressive Web App**: Installable as a standalone application on desktop and mobile
- **Adaptive Network Strategy**: Smart timeout handling for slow connections
- **Model Management**: Download and cache models locally for instant access
- **Stream Response**: Real-time streaming of model responses with token usage metrics

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start the server
node server.js

# Visit http://localhost:3000
```

### Docker Deployment

```bash
# Build the image
docker build -t resaka .

# Run the container
docker run -p 3000:3000 resaka
```

### Using Docker Hub Image

```bash
docker pull [your-dockerhub-username]/resaka:latest
docker run -p 3000:3000 [your-dockerhub-username]/resaka:latest
```

## 🏗️ Architecture

### Core Components

- **`main.js`**: WebLLM integration, UI management, and chat logic
- **`server.js`**: Express server with cache version management and rescue mechanism
- **`service-worker.js`**: Intelligent offline caching with adaptive network strategies
- **`context.js`**: Specialized conversation contexts and system prompts
- **`styles.js`**: Dynamic style injection for the UI

### Caching Strategy

The application implements a sophisticated "Get once, always work, update if possible" strategy:

1. **First-time users**: Extended timeout (20-30s) to ensure complete download on slow networks
2. **Returning users**: Short timeout (3-5s) with immediate cache fallback
3. **Atomic updates**: All-or-nothing cache updates to prevent version mismatches
4. **Cache rescue**: Automatic detection and recovery from cache lock situations

## 📱 Context Modes

Available conversation contexts:

- **General**: Open-ended conversations
- **Encyclopedia**: Factual, verifiable knowledge only
- **Language Tutor**: Grammar and phrasing assistance
- **Cooking**: Recipes with detailed steps
- **Procedural/How-to**: Step-by-step instructions
- **Technical Support**: Problem diagnosis and solutions
- **Summary**: Content summarization
- **Decision Support**: Objective option comparison
- **Content Drafting**: Structured document creation
- **Programming**: Code explanation and examples
- **Planning**: Task organization and time estimation

## ⚙️ Configuration

### Environment Variables

```bash
# Cache version management
CACHE_VERSION=v2                    # Change to deploy new version
APP_NAME=resaka                     # Application name for cache prefixing

# Service Worker timeouts
SW_FIRST_TIME_TIMEOUT=20000         # First load timeout (ms)
SW_RETURNING_USER_TIMEOUT=5000      # Returning user timeout (ms)
SW_ENABLE_LOGS=true                 # Enable service worker logging

# Server
PORT=3000                           # Server port
```

### Model Configuration

Models are automatically detected from WebLLM's prebuilt configurations. The UI shows which models are cached locally with ✅/❌ indicators.

## 🔧 Technical Requirements

### Browser Requirements
- **WebGPU support** (Chrome 113+, Edge 113+, or other WebGPU-enabled browsers)
- Modern JavaScript support (ES6+)
- Service Worker support for offline functionality

### Server Requirements
- Node.js 20+ (uses Node 23-alpine in Docker)
- Express.js for serving static files

## 🐳 Docker Support

The project includes a Dockerfile for containerization and GitHub Actions workflow for automated Docker Hub deployment.

### GitHub Actions Setup

1. Add Docker Hub credentials to your repository secrets:
   - `DOCKERHUB_USERNAME`: Your Docker Hub username
   - `DOCKERHUB_TOKEN`: Docker Hub access token

2. Trigger manual deployment:
   - Go to Actions tab → "Manual Build and Push Docker Image"
   - Click "Run workflow"

## 📦 Project Structure

```
resaka/
├── index.html           # Main HTML entry point
├── main.js             # Core application logic
├── server.js           # Express server with cache management
├── service-worker.js   # Offline caching strategy
├── context.js          # Conversation contexts
├── styles.js           # Dynamic styles
├── manifest.json       # PWA manifest
├── package.json        # Node dependencies
├── Dockerfile          # Container configuration
└── .github/
    └── workflows/
        └── main.yml    # CI/CD pipeline
```

## 🔐 Privacy & Security

- **Local Processing**: All LLM inference happens in your browser
- **No Data Collection**: Conversations are not sent to any server
- **Offline Operation**: Works completely offline once models are cached
- **Cache Isolation**: Each version maintains separate cache storage

## 📄 License

MIT License - Copyright (c) 2025 Mino

See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [WebLLM](https://github.com/mlc-ai/web-llm) by MLC
- Uses WebGPU for accelerated inference
- Progressive Web App capabilities for offline support

## 🐛 Troubleshooting

### Model won't load
- Ensure WebGPU is supported in your browser
- Check console for specific error messages
- Try clearing cache and reloading

### Cache lock issues
- The app includes automatic cache rescue mechanisms
- If stuck, clear browser storage and reload

### Slow initial load
- First-time users may experience longer load times (up to 30s)
- This ensures complete caching for offline use
- Subsequent loads will be much faster

## 📊 Performance Notes

- Model download sizes vary (typically 1-4GB)
- Initial model loading may take 30-60 seconds
- Response generation speed depends on model size and device GPU
- Cache strategy optimized for reliability over speed
