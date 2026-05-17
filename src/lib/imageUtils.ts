export async function resizeImage(file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const resizedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              })
              resolve(resizedFile)
            } else {
              resolve(file) // Fallback to original file if blob creation fails
            }
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = () => resolve(file) // Fallback to original file if image loading fails
    }
    reader.onerror = () => resolve(file) // Fallback to original file if file reading fails
  })
}