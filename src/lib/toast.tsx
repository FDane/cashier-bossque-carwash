import toast from 'react-hot-toast'

export const showToast = {
  success: (message: string, duration = 3000) => {
    toast.success(message, {
      duration,
      position: 'top-right',
      style: {
        background: '#10b981',
        color: '#fff',
        fontWeight: '600',
      },
    })
  },

  error: (message: string, duration = 3000) => {
    toast.error(message, {
      duration,
      position: 'top-right',
      style: {
        background: '#ef4444',
        color: '#fff',
        fontWeight: '600',
      },
    })
  },

  warning: (message: string, duration = 3000) => {
    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? 'animate-fadeIn' : 'opacity-0'
          } bg-amber-500 text-white px-4 py-3 rounded-lg font-semibold`}
        >
          {message}
        </div>
      ),
      {
        duration,
        position: 'top-right',
      }
    )
  },

  info: (message: string, duration = 3000) => {
    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? 'animate-fadeIn' : 'opacity-0'
          } bg-blue-500 text-white px-4 py-3 rounded-lg font-semibold`}
        >
          {message}
        </div>
      ),
      {
        duration,
        position: 'top-right',
      }
    )
  },
}