// Service to fetch configuration from backend
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

interface AppConfig {
  firebase: FirebaseConfig;
  environment: string;
  version: string;
}

class ConfigService {
  private config: AppConfig | null = null;
  private configPromise: Promise<AppConfig> | null = null;

  async getConfig(): Promise<AppConfig> {
    // Return cached config if available
    if (this.config) {
      return this.config;
    }

    // Return existing promise if already fetching
    if (this.configPromise) {
      return this.configPromise;
    }

    // Create new promise to fetch config
    this.configPromise = this.fetchConfig();
    return this.configPromise;
  }

  private async fetchConfig(): Promise<AppConfig> {
    try {
      // Try different backend URLs based on environment
      const possibleUrls = [
        process.env.REACT_APP_API_BASE_URL, // If set in environment
        'https://f2p-buddy-api-xyz123-uc.a.run.app', // Cloud Run URL (update when deployed)
        'http://localhost:8080', // Local development
      ].filter(Boolean);

      let lastError: Error | null = null;

      for (const baseUrl of possibleUrls) {
        try {
          console.log(`Trying to fetch config from: ${baseUrl}`);
          
          const response = await fetch(`${baseUrl}/api/config`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            // Add timeout
            signal: AbortSignal.timeout(10000), // 10 seconds
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          
          if (!data.success || !data.config) {
            throw new Error('Invalid config response format');
          }

          // Validate required fields
          const config = data.config as AppConfig;
          if (!config.firebase.apiKey || !config.firebase.projectId) {
            throw new Error('Missing required Firebase configuration');
          }

          // Cache the config
          this.config = config;
          console.log('✅ Firebase config loaded from backend:', config.firebase.projectId);
          
          return config;
        } catch (error) {
          console.warn(`Failed to fetch config from ${baseUrl}:`, error);
          lastError = error as Error;
          continue;
        }
      }

      // If all URLs failed, throw the last error
      throw new Error(`Failed to fetch config from all endpoints. Last error: ${lastError?.message}`);
      
    } catch (error) {
      console.error('❌ Failed to load configuration:', error);
      
      // Fallback to environment variables if available (for development)
      if (process.env.REACT_APP_FIREBASE_API_KEY && process.env.REACT_APP_FIREBASE_PROJECT_ID) {
        console.warn('🔄 Falling back to environment variables');
        
        const fallbackConfig: AppConfig = {
          firebase: {
            apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
            authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'f2p-buddy-1756234727.firebaseapp.com',
            projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'f2p-buddy-1756234727',
            storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'f2p-buddy-1756234727.appspot.com',
            messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
            appId: process.env.REACT_APP_FIREBASE_APP_ID || '',
          },
          environment: 'development',
          version: '1.0.0-dev',
        };
        
        this.config = fallbackConfig;
        return fallbackConfig;
      }
      
      throw new Error('No configuration available. Backend is required for production.');
    }
  }

  // Clear cached config (useful for testing)
  clearCache(): void {
    this.config = null;
    this.configPromise = null;
  }

  // Get cached config synchronously (returns null if not loaded)
  getCachedConfig(): AppConfig | null {
    return this.config;
  }
}

// Export singleton instance
export const configService = new ConfigService();
export type { AppConfig, FirebaseConfig };