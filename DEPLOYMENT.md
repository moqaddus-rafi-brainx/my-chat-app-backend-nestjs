# Vercel Deployment Guide

This guide will help you deploy both your NestJS backend and frontend to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **MongoDB Atlas**: Set up a cloud database at [mongodb.com/atlas](https://mongodb.com/atlas)
3. **GitHub Repository**: Push your code to GitHub

## Backend Deployment (NestJS)

### 1. Prepare Your Backend

The following files have been created for you:
- `vercel.json` - Vercel configuration
- `.vercelignore` - Files to ignore during deployment
- `env.example` - Environment variables template

### 2. Set Up MongoDB Atlas

1. Go to [MongoDB Atlas](https://mongodb.com/atlas)
2. Create a new cluster
3. Create a database user
4. Whitelist all IP addresses (0.0.0.0/0) for Vercel
5. Get your connection string

### 3. Deploy Backend to Vercel

#### Option A: Using Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from your backend directory
cd my-chat-app-backend-nestjs
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name: my-chat-app-backend
# - Directory: ./
```

#### Option B: Using Vercel Dashboard
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Select the backend folder as root directory
5. Configure build settings:
   - **Framework Preset**: Other
   - **Build Command**: `npm run vercel-build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### 4. Configure Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add the following variables:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chat-app?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.vercel.app
WS_CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

**Important**: Replace the placeholder values with your actual:
- MongoDB Atlas connection string
- Strong JWT secret (use a random string generator)
- Your frontend domain (you'll get this after deploying the frontend)

### 5. Redeploy

After adding environment variables, redeploy your project:
```bash
vercel --prod
```

## Frontend Deployment

### 1. Prepare Your Frontend

If you have a React/Next.js frontend, create these files in your frontend directory:

#### `vercel.json` (for frontend)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

#### Update `package.json` scripts
```json
{
  "scripts": {
    "build": "your-build-command",
    "vercel-build": "npm run build"
  }
}
```

### 2. Deploy Frontend

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Select the frontend folder as root directory
5. Configure build settings:
   - **Framework Preset**: Your framework (React, Next.js, etc.)
   - **Build Command**: `npm run vercel-build`
   - **Output Directory**: `dist` or `build` (depending on your framework)

### 3. Configure Frontend Environment Variables

Add these to your frontend Vercel project:

```
REACT_APP_API_URL=https://your-backend-domain.vercel.app
# or
NEXT_PUBLIC_API_URL=https://your-backend-domain.vercel.app
```

## Important Notes

### WebSocket Considerations

Vercel has limitations with WebSocket connections:
- **Serverless Functions**: WebSocket connections may not persist
- **Alternative Solutions**:
  1. Use **Vercel Pro** for better WebSocket support
  2. Consider using **Pusher**, **Socket.io with Redis**, or **Ably** for real-time features
  3. Use **Vercel Edge Functions** for better performance

### CORS Configuration

Make sure your backend CORS is configured for your frontend domain:
```typescript
// In your main.ts
app.enableCors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
});
```

### Database Connection

Use MongoDB Atlas for production:
- Never use local MongoDB in production
- Ensure your connection string includes proper authentication
- Whitelist Vercel's IP ranges or use 0.0.0.0/0 for development

## Testing Your Deployment

1. **Backend**: Visit `https://your-backend-domain.vercel.app` - you should see your API
2. **Frontend**: Visit `https://your-frontend-domain.vercel.app` - your app should load
3. **API Endpoints**: Test your endpoints using the deployed backend URL
4. **WebSocket**: Test real-time features (may need alternative solution for production)

## Troubleshooting

### Common Issues

1. **Build Failures**: Check your build logs in Vercel dashboard
2. **Environment Variables**: Ensure all required variables are set
3. **CORS Errors**: Verify CORS_ORIGIN matches your frontend domain
4. **Database Connection**: Check MongoDB Atlas connection string and IP whitelist
5. **WebSocket Issues**: Consider using external WebSocket service for production

### Useful Commands

```bash
# Check deployment logs
vercel logs

# Redeploy with specific environment
vercel --prod

# Check project status
vercel ls
```

## Next Steps

1. Set up custom domains (optional)
2. Configure monitoring and analytics
3. Set up CI/CD for automatic deployments
4. Consider using Vercel Pro for better WebSocket support
5. Implement proper error handling and logging

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [NestJS Deployment Guide](https://docs.nestjs.com/recipes/deployment)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
