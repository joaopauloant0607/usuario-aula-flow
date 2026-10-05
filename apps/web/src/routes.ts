import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
	index('routes/home.tsx'),
 route('login', 'routes/login.tsx'),
 route('plans', 'routes/plans.tsx'),
 route('subscriptions', 'routes/subscriptions.tsx'),
 route('app', 'routes/app.tsx'),
 route('api/ecommerce/subscriptions', 'routes/api.ecommerce.subscriptions.ts'),
 route('api/ecommerce/subscriptions/manage', 'routes/api.ecommerce.subscriptions.manage.ts'), 
	route('sitemap.xml', 'routes/sitemap.xml.ts'),
	route('robots.txt', 'routes/robots.txt.ts'),
	route('api/health', 'routes/api.health.ts'),
	route('api/*', 'routes/api.$.ts'),
] satisfies RouteConfig;
