import React, { Component, ErrorInfo, ReactNode } from 'react';

interface State {
  hasError: boolean;
}

// FIX: Refactored the component's props typing to use `React.PropsWithChildren` to resolve a subtle TypeScript error where `props` was not recognized. This is a more robust way to type components that expect `children`.
class ErrorBoundary extends Component<React.PropsWithChildren<{}>, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    // Atualiza o estado para que a próxima renderização mostre a UI de fallback.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Você também pode registrar o erro em um serviço externo aqui
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-red-50 rounded-xl">
          {/* FIX: Changed h1 to h2 for better semantic HTML. */}
          <h2 className="text-2xl font-bold text-red-700 mb-4">Oops! Algo deu errado.</h2>
          <p className="text-red-600 mb-6 max-w-md">
            Ocorreu um erro inesperado ao tentar exibir esta tela. Isso pode ter sido causado por uma resposta inesperada da IA ou um problema de renderização.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Recarregar Aplicativo
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;