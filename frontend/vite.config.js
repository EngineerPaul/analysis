import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite configuration with optional ROOT_PATH base for production deploy.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rootPath = env.VITE_ROOT_PATH || '/extra/analysis';

  return {
    plugins: [react()],
    base: `${rootPath}/`,
    server: {
      host: '0.0.0.0',
      port: 9001,
    },
    preview: {
      host: '0.0.0.0',
      port: 9001,
    },
  };
});
