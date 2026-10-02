"""Custom exceptions for the Analysis service layer.

These are plain Python exceptions, decoupled from HTTP. The route layer is
responsible for catching them and raising the appropriate HTTPException.
"""


class AnalysisServiceError(Exception):
    """Base class for all Analysis service errors."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class AlertNotFoundError(AnalysisServiceError):
    """Raised when the referenced Alert does not exist in the database."""


class AnalysisNotFoundError(AnalysisServiceError):
    """Raised when a requested Analysis does not exist in the database."""


class InvalidAnalysisStateError(AnalysisServiceError):
    """Raised when an operation is invalid for the current analysis state.

    Example: trying to add evidence to an analysis that does not exist.
    """
