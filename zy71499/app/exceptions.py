from fastapi import HTTPException


class AuthorizationExpiredError(HTTPException):
    def __init__(self, contract_id: int, end_date: str):
        super().__init__(
            status_code=422,
            detail={
                "error_code": "AUTH_EXPIRED",
                "message": f"Contract {contract_id} authorization expired on {end_date}",
                "detail": "Cannot perform this action on an expired authorization contract",
            },
        )


class EpisodeOveruseError(HTTPException):
    def __init__(self, contract_id: int, authorized: int, used: int):
        super().__init__(
            status_code=422,
            detail={
                "error_code": "EPISODE_OVERUSE",
                "message": f"Contract {contract_id} has reached episode limit ({used}/{authorized})",
                "detail": "Cannot add more episodes beyond the authorized count",
            },
        )


class InvalidStatusTransitionError(HTTPException):
    def __init__(self, contract_id: int, from_status: str, to_status: str):
        super().__init__(
            status_code=422,
            detail={
                "error_code": "INVALID_STATUS_TRANSITION",
                "message": f"Cannot transition contract {contract_id} from {from_status} to {to_status}",
                "detail": "Status transition violates the authorization state machine rules",
            },
        )


class FileVersionMismatchError(HTTPException):
    def __init__(self, contract_id: int, locked_version: str, current_version: str):
        super().__init__(
            status_code=422,
            detail={
                "error_code": "FILE_VERSION_MISMATCH",
                "message": f"Contract {contract_id} locked version {locked_version} differs from current version {current_version}",
                "detail": "Cannot distribute file with mismatched version under this contract",
            },
        )


class ContractNotConfirmedError(HTTPException):
    def __init__(self, contract_id: int, current_status: str):
        super().__init__(
            status_code=422,
            detail={
                "error_code": "CONTRACT_NOT_CONFIRMED",
                "message": f"Contract {contract_id} is in '{current_status}' status, not confirmed",
                "detail": "Episode usage is only allowed under confirmed contracts",
            },
        )


class EntityNotFoundError(HTTPException):
    def __init__(self, entity_type: str, entity_id: int):
        super().__init__(
            status_code=404,
            detail={
                "error_code": "ENTITY_NOT_FOUND",
                "message": f"{entity_type} with id {entity_id} not found",
                "detail": None,
            },
        )


class DuplicateEpisodeError(HTTPException):
    def __init__(self, contract_id: int, episode_number: int):
        super().__init__(
            status_code=409,
            detail={
                "error_code": "DUPLICATE_EPISODE",
                "message": f"Episode {episode_number} already exists under contract {contract_id}",
                "detail": "Each episode number must be unique within a contract",
            },
        )
