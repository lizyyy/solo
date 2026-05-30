import { useRef, useState, useEffect } from 'react'

interface DragData {
  type: string
  data: unknown
}

const DRAG_PREFIX = 'app-drag:'

export function useDrag<T>({ type, data, disabled = false }: {
  type: string
  data: T
  disabled?: boolean
}) {
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<HTMLElement | null>(null)

  const drag = (node: HTMLElement | null) => {
    dragRef.current = node
  }

  useEffect(() => {
    const node = dragRef.current
    if (!node || disabled) return

    node.setAttribute('draggable', 'true')

    const handleDragStart = (e: DragEvent) => {
      setIsDragging(true)
      const payload: DragData = { type, data }
      e.dataTransfer?.setData('text/plain', DRAG_PREFIX + JSON.stringify(payload))
      e.dataTransfer!.effectAllowed = 'move'
    }

    const handleDragEnd = () => {
      setIsDragging(false)
    }

    node.addEventListener('dragstart', handleDragStart)
    node.addEventListener('dragend', handleDragEnd)

    return () => {
      node.removeEventListener('dragstart', handleDragStart)
      node.removeEventListener('dragend', handleDragEnd)
    }
  }, [type, data, disabled])

  return { drag, isDragging }
}

export function useDrop<T>({ accept, onDrop }: {
  accept: string
  onDrop: (data: T) => void
}) {
  const [isOver, setIsOver] = useState(false)
  const dropRef = useRef<HTMLElement | null>(null)

  const drop = (node: HTMLElement | null) => {
    dropRef.current = node
  }

  useEffect(() => {
    const node = dropRef.current
    if (!node) return

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      setIsOver(true)
    }

    const handleDragLeave = () => {
      setIsOver(false)
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      setIsOver(false)

      const raw = e.dataTransfer?.getData('text/plain')
      if (!raw?.startsWith(DRAG_PREFIX)) return

      try {
        const payload: DragData = JSON.parse(raw.slice(DRAG_PREFIX.length))
        if (payload.type === accept) {
          onDrop(payload.data as T)
        }
      } catch {
        // ignore
      }
    }

    node.addEventListener('dragover', handleDragOver)
    node.addEventListener('dragleave', handleDragLeave)
    node.addEventListener('drop', handleDrop)

    return () => {
      node.removeEventListener('dragover', handleDragOver)
      node.removeEventListener('dragleave', handleDragLeave)
      node.removeEventListener('drop', handleDrop)
    }
  }, [accept, onDrop])

  return { drop, isOver }
}
