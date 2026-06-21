import { useEffect, useState } from 'react'
import { useProjectStore } from '@/store'
import { fetchProjects } from '@/api'

export function useEnsureProject() {
  const { currentProjectId, setCurrentProjectId } = useProjectStore()
  const [ready, setReady] = useState(false)
  const [noProject, setNoProject] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function ensure() {
      if (currentProjectId) {
        if (!cancelled) {
          setNoProject(false)
          setReady(true)
        }
        return
      }
      try {
        const projects = await fetchProjects()
        if (cancelled) return
        if (projects && projects.length > 0) {
          setCurrentProjectId(projects[0].id)
          setNoProject(false)
        } else {
          setNoProject(true)
        }
      } catch {
        if (!cancelled) setNoProject(true)
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    ensure()

    return () => {
      cancelled = true
    }
  }, [currentProjectId, setCurrentProjectId])

  return { currentProjectId, ready, noProject }
}
