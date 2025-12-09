export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              🎯 Slack Retro
            </h1>
            <p className="text-xl text-gray-600">
              Run team retrospectives directly in Slack
            </p>
          </div>

          {/* Status Card */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></div>
              <span className="text-lg font-semibold text-gray-700">
                App is running
              </span>
            </div>

            <div className="border-t pt-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                API Endpoints
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <code className="text-sm text-gray-700">/api/slack/events</code>
                  <span className="text-sm text-green-600 font-medium">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <code className="text-sm text-gray-700">/api/init-db</code>
                  <span className="text-sm text-green-600 font-medium">Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Features</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  😊 Discussion Items
                </h3>
                <p className="text-gray-600 text-sm">
                  Add items in three categories: what went well, what could be improved, and questions
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  ✅ Action Items
                </h3>
                <p className="text-gray-600 text-sm">
                  Track action items with assigned owners and completion status
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  📋 Retro Summaries
                </h3>
                <p className="text-gray-600 text-sm">
                  Generate markdown summaries of completed retrospectives
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  🕐 Past Retros
                </h3>
                <p className="text-gray-600 text-sm">
                  View historical retro summaries and track team progress
                </p>
              </div>
            </div>
          </div>

          {/* How to Use */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              How to Use
            </h2>
            <ol className="space-y-3 text-gray-700">
              <li className="flex">
                <span className="font-bold text-purple-600 mr-3">1.</span>
                <span>Open Slack and find the Retro Bot app in your workspace</span>
              </li>
              <li className="flex">
                <span className="font-bold text-purple-600 mr-3">2.</span>
                <span>Click on the app to open the Home tab</span>
              </li>
              <li className="flex">
                <span className="font-bold text-purple-600 mr-3">3.</span>
                <span>Add discussion items and action items during your retro</span>
              </li>
              <li className="flex">
                <span className="font-bold text-purple-600 mr-3">4.</span>
                <span>Click "Finish Retro" when done to save a summary</span>
              </li>
            </ol>
          </div>

          {/* Footer */}
          <div className="text-center text-gray-500 text-sm">
            <p>
              This is a Slack app. All functionality is accessed through the Slack App Home tab.
            </p>
            <p className="mt-2">
              Need help? Check the{" "}
              <a
                href="https://github.com/denwilliams/slack-retro"
                className="text-purple-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                documentation
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
