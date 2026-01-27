import React from "react"
import { Skeleton } from "./Skeleton"
import { VStack, HStack } from "@fider/components/layout"

interface PostSkeletonProps {
  count?: number
}

const SinglePostSkeleton: React.FC = () => {
  return (
    <div className="c-posts-container__post w-full" style={{ padding: "16px", background: "var(--colors-white)", borderRadius: "12px", marginBottom: "12px" }}>
      <VStack spacing={4}>
        <HStack justify="between" align="start">
          <Skeleton variant="text" width="70%" height={20} />
          <Skeleton variant="text" width={40} height={20} />
        </HStack>
        <VStack spacing={2}>
          <Skeleton variant="text" width="100%" height={14} />
          <Skeleton variant="text" width="85%" height={14} />
        </VStack>
        <HStack spacing={2}>
          <Skeleton variant="rectangular" width={60} height={24} borderRadius="12px" />
          <Skeleton variant="rectangular" width={80} height={24} borderRadius="12px" />
        </HStack>
        <HStack justify="between" align="center">
          <HStack spacing={1}>
            <Skeleton variant="text" width={32} height={24} />
            <Skeleton variant="text" width={40} height={16} />
          </HStack>
        </HStack>
      </VStack>
    </div>
  )
}

export const PostSkeleton: React.FC<PostSkeletonProps> = ({ count = 3 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <SinglePostSkeleton key={index} />
      ))}
    </>
  )
}
