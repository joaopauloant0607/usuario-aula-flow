import PocketBase from 'pocketbase';

// Horizons routes /hcgi/platform to PocketBase (locally, the Vite proxy does).
// Other hosts set VITE_POCKETBASE_URL to the database address at build time.
const POCKETBASE_API_URL: string = import.meta.env.VITE_POCKETBASE_URL || '/hcgi/platform';

const pocketbaseClient = new PocketBase(POCKETBASE_API_URL);

export default pocketbaseClient;

export { pocketbaseClient, POCKETBASE_API_URL };
