import { createBrowserRouter, RouterProvider } from 'react-router';
import { lazy, Suspense } from 'react';
import { Shell } from './ui/Shell';
import HomePage from './features/home/HomePage';

const Paint = lazy(() => import('./features/paint/PaintPage'));
const Camera = lazy(() => import('./features/camera/CameraPage'));
const Learn = lazy(() => import('./features/learn/LearnPage'));
const Solved = lazy(() => import('./features/solved/SolvedPage'));

const wrap = (el: React.ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'paint', element: wrap(<Paint />) },
      { path: 'camera', element: wrap(<Camera />) },
      { path: 'learn', element: wrap(<Learn />) },
      { path: 'solved', element: wrap(<Solved />) },
    ],
  },
], { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' });

export function App() {
  return <RouterProvider router={router} />;
}
