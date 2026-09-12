import { Suspense } from 'react'
import { LabViewer } from '@/features/gift/lab/LabViewer'

/**
 * /lab?src=/rive/candy.riv&w=96&h=96&at=1.2
 * Plays one .riv on a plain background for visual QA and screenshot bisecting.
 */
export default function LabPage() {
  return (
    <Suspense>
      <LabViewer />
    </Suspense>
  )
}
