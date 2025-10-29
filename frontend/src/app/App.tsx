import './App.css'
import { WorkFlowPage } from '../pages/workflow'
import { ErrorBoundary } from '../app/components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <WorkFlowPage />
    </ErrorBoundary>
  )
}

export default App
