import { useRef, useState, useEffect, useCallback } from 'react'
import { Hands } from '@mediapipe/hands'
import { Camera } from '@mediapipe/camera_utils'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { HAND_CONNECTIONS } from '@mediapipe/hands'
import { recognizeGesture } from '@/engine/gestureEngine'
import type { GestureResult } from '@/types/game'

type OnGestureResult = (result: GestureResult) => void

export function useGestureDetection() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isReady, setIsReady] = useState(false)
  const [lastGesture, setLastGesture] = useState<GestureResult | null>(null)
  const handsRef = useRef<Hands | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const callbackRef = useRef<OnGestureResult | null>(null)

  const onResults = useCallback((results: any) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.save()
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (const landmarks of results.multiHandLandmarks) {
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
          color: '#7B2D8E',
          lineWidth: 3,
        })
        drawLandmarks(ctx, landmarks, {
          color: '#FF8C42',
          lineWidth: 1,
          radius: 4,
        })
      }

      const gesture = recognizeGesture(results.multiHandLandmarks[0])
      setLastGesture(gesture)
      callbackRef.current?.(gesture)
    }

    ctx.restore()
  }, [])

  const startCamera = useCallback(async () => {
    if (handsRef.current) return

    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    })
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    })
    hands.onResults(onResults)
    handsRef.current = hands

    const video = videoRef.current
    if (!video) return

    const camera = new Camera(video, {
      onFrame: async () => {
        await hands.send({ image: video })
      },
      width: 640,
      height: 480,
    })
    cameraRef.current = camera

    await camera.start()
    setIsReady(true)
  }, [onResults])

  const stopCamera = useCallback(() => {
    cameraRef.current?.stop()
    cameraRef.current = null
    handsRef.current?.close()
    handsRef.current = null
    setIsReady(false)
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return {
    videoRef,
    canvasRef,
    isReady,
    lastGesture,
    startCamera,
    stopCamera,
    callbackRef,
  }
}

export default function CameraView() {
  const { videoRef, canvasRef, isReady, startCamera } = useGestureDetection()

  useEffect(() => {
    startCamera()
  }, [startCamera])

  return (
    <div className="relative rounded-2xl overflow-hidden glow-purple">
      <video
        ref={videoRef}
        className="w-full h-full object-cover -scale-x-100"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full -scale-x-100"
        width={640}
        height={480}
      />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-deep/80">
          <span className="font-body text-lg text-primary-purple animate-pulse">
            正在启动摄像头...
          </span>
        </div>
      )}
    </div>
  )
}
