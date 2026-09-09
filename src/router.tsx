import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { lazy, Suspense } from 'react';
import { Shell } from './ui/Shell';
import SolvePage from './features/solve/SolvePage';

const Scan = lazy(() => import('./features/scan/ScanPage'));
const Fix = lazy(() => import('./features/fix/FixPage'));
const Play = lazy(() => import('./features/play/PlayPage'));
const Journey = lazy(() => import('./features/journey/JourneyPage'));
const Learn = lazy(() => import('./features/learn/LearnPage'));
const Solved = lazy(() => import('./features/solved/SolvedPage'));

const wrap = (el: React.ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <SolvePage /> },
      { path: 'scan', element: wrap(<Scan />) },
      { path: 'fix', element: wrap(<Fix />) },
      { path: 'play', element: wrap(<Play />) },
      { path: 'journey', element: wrap(<Journey />) },
      { path: 'learn', element: wrap(<Learn />) },
      { path: 'learn/:chapter', element: wrap(<Learn />) },
      { path: 'solved', element: wrap(<Solved />) },
      // old links
      { path: 'paint', element: <Navigate to="/fix" replace /> },
      { path: 'camera', element: <Navigate to="/scan" replace /> },
    ],
  },
], { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' });

export function App() {
  return <RouterProvider router={router} />;
}
