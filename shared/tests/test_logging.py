import logging
from mock_interview_shared.utils.logging import get_logger, JSONFormatter


def test_get_logger_returns_logger():
    logger = get_logger("test")
    assert isinstance(logger, logging.Logger)


def test_get_logger_has_json_formatter():
    logger = get_logger("test.json_formatter")
    assert logger.handlers, "Logger should have at least one handler"
    handler = logger.handlers[0]
    assert isinstance(handler.formatter, JSONFormatter)


def test_get_logger_does_not_duplicate_handlers():
    logger1 = get_logger("test.dedup")
    logger2 = get_logger("test.dedup")
    assert len(logger2.handlers) == 1


def test_get_logger_logs_without_exception(capfd):
    logger = get_logger("test.output")
    logger.info("hello from test")
    captured = capfd.readouterr()
    assert "hello from test" in captured.out


def test_json_formatter_output_is_valid_json(capfd):
    import json

    logger = get_logger("test.json_output")
    logger.info("structured log")
    captured = capfd.readouterr()
    parsed = json.loads(captured.out.strip())
    assert parsed["message"] == "structured log"
    assert parsed["level"] == "INFO"
    assert "timestamp" in parsed
    assert "logger" in parsed
