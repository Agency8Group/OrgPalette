class OrgChartSystem {
    constructor() {
        this.people = [];
        this.svg = null;
        this.treeLayout = null;
        this.zoom = null;
        this.currentTransform = d3.zoomIdentity;
        this.teamColors = new Map(); // 팀별 색상 캐시
        this.usedColors = new Set(); // 사용된 색상 추적
        
        // 자리배치도 관련 속성들
        this.currentTab = 'org-chart';
        this.seatGrid = [];
        this.selectedSeats = new Set();
        this.teamCards = [];
        this.isSelecting = false;
        this.dragStartSeat = null;
        this.gridCols = 12;
        this.gridRows = 8;
        this.seatZoom = 1;
        this.seatPanX = 0;
        this.seatPanY = 0;
        
        // 상호작용 모드 관련 속성들
        this.interactionMode = 'selection-only';
        this.clickMoveSource = null;
        this.contextMenu = null;
        
        // 색상 모드 관련 속성들
        this.currentColorMode = 'none';
        
        // 특별 구역 관련 속성들
        this.specialZones = new Map(); // 좌석 ID -> 특별 구역 타입
        this.specialZoneMode = null; // 현재 설정 모드 ('entrance', 'restroom', null)
        
        // 강필구 대표이사님 기본 정보
        this.ceoInfo = {
            name: '강필구',
            position: '대표이사',
            task: '전략기획',
            department: '경영진',
            manager: ''
        };
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeD3();
        this.initializeSeatGrid();
        
        // 자동 저장 데이터 확인 후 로드
        this.initializeData();
        
        // 초기 상태 설정: 좌석 선택 모드 활성화
        this.handleInteractionModeChange({ target: { value: 'selection-only' } });
    }

    initializeData() {
        // 자동 저장 데이터 확인
        const autoSaveData = this.loadFromAutoSave();
        
        if (autoSaveData.length > 0) {
            this.people = autoSaveData;
            this.ensureCEOExists();
            this.enforceCEODefaults();
            this.updatePeopleList();
            this.updateChart();
            
            // 복원된 데이터를 거시적 관점으로 보기
            setTimeout(() => {
                this.fitToView();
            }, 200);
            
            this.updateStatus('이전 작업 데이터가 자동으로 복원되었습니다.');
        } else {
            // 자동 저장 데이터가 없으면 샘플 데이터 로드
            this.loadSampleDataInternal();
        }
    }

    initializeElements() {
        this.elements = {
            // 기존 조직도 관련 요소들
            excelUpload: document.getElementById('excel-upload'),
            sampleDataBtn: document.getElementById('sample-data-btn'),
            inputRows: document.getElementById('input-rows'),
            addAllBtn: document.getElementById('add-all-btn'),
            clearInputsBtn: document.getElementById('clear-inputs-btn'),
            clearAllBtn: document.getElementById('clear-all-btn'),
            exportExcelBtn: document.getElementById('export-excel-btn'),
            exportPdfBtn: document.getElementById('export-pdf-btn'),
            peopleList: document.getElementById('people-list'),
            orgChart: document.getElementById('org-chart'),
            statusMessage: document.getElementById('status-message'),
            personCount: document.getElementById('person-count'),
            zoomInBtn: document.getElementById('zoom-in-btn'),
            zoomOutBtn: document.getElementById('zoom-out-btn'),
            resetZoomBtn: document.getElementById('reset-zoom-btn'),
            centerBtn: document.getElementById('center-btn'),
            fitViewBtn: document.getElementById('fit-view-btn'),
            confirmModal: document.getElementById('confirm-modal'),
            confirmYes: document.getElementById('confirm-yes'),
            confirmNo: document.getElementById('confirm-no'),
            
            // 탭 시스템 관련 요소들
            tabBtns: document.querySelectorAll('.tab-btn'),
            orgChartTab: document.getElementById('org-chart-tab'),
            seatLayoutTab: document.getElementById('seat-layout-tab'),
            
            // 자리배치도 관련 요소들
            gridCols: document.getElementById('grid-cols'),
            gridRows: document.getElementById('grid-rows'),
            applyGridBtn: document.getElementById('apply-grid-btn'),
            seatGrid: document.getElementById('seat-grid'),
            teamCardsList: document.getElementById('team-cards-list'),
            seatInfo: document.getElementById('seat-info'),
            seatZoomInBtn: document.getElementById('seat-zoom-in-btn'),
            seatZoomOutBtn: document.getElementById('seat-zoom-out-btn'),
            seatResetZoomBtn: document.getElementById('seat-reset-zoom-btn'),
            seatCenterBtn: document.getElementById('seat-center-btn'),
            
            // 팀 할당 팝업 관련 요소들
            teamAssignModal: document.getElementById('team-assign-modal'),
            teamDropdown: document.getElementById('team-dropdown'),
            teamMemberCount: document.getElementById('team-member-count'),
            teamMembersPreview: document.getElementById('team-members-preview'),
            customTeamNameInput: document.getElementById('custom-team-name-input'),
            teamMembersList: document.getElementById('team-members-list'),
            selectedSeatsCount: document.getElementById('selected-seats-count'),
            seatTeamMatch: document.getElementById('seat-team-match'),
            teamModeSection: document.getElementById('team-mode-section'),
            individualModeSection: document.getElementById('individual-mode-section'),
            teamAssignCancel: document.getElementById('team-assign-cancel'),
            teamAssignConfirm: document.getElementById('team-assign-confirm')
        };
        
        // 입력 행 카운터
        this.rowCounter = 1;
    }

    setupEventListeners() {
        // 기존 조직도 관련 이벤트 리스너들
        this.elements.excelUpload.addEventListener('change', (e) => this.handleExcelUpload(e));
        this.elements.sampleDataBtn.addEventListener('click', () => this.loadSampleData());
        this.elements.addAllBtn.addEventListener('click', () => this.addAllPeople());
        this.elements.clearInputsBtn.addEventListener('click', () => this.clearInputs());
        this.elements.clearAllBtn.addEventListener('click', () => this.clearAll());
        this.elements.exportExcelBtn.addEventListener('click', () => this.exportToExcel());
        this.elements.exportPdfBtn.addEventListener('click', () => this.exportToPDF(true));

        this.elements.zoomInBtn.addEventListener('click', () => this.zoomIn());
        this.elements.zoomOutBtn.addEventListener('click', () => this.zoomOut());
        this.elements.resetZoomBtn.addEventListener('click', () => this.resetZoom());
        this.elements.centerBtn.addEventListener('click', () => this.centerChart());
        this.elements.fitViewBtn.addEventListener('click', () => this.fitToView());
        
        // 확인 팝업 이벤트
        this.elements.confirmYes.addEventListener('click', () => this.confirmLoadSampleData());
        this.elements.confirmNo.addEventListener('click', () => this.hideConfirmModal());
        
        // 팝업 외부 클릭 시 닫기
        this.elements.confirmModal.addEventListener('click', (e) => {
            if (e.target === this.elements.confirmModal) {
                this.hideConfirmModal();
            }
        });
        
        // 탭 시스템 이벤트 리스너
        this.elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
        
        // 자리배치도 관련 이벤트 리스너들
        this.elements.applyGridBtn.addEventListener('click', () => this.applyGridSettings());
        this.elements.seatZoomInBtn.addEventListener('click', () => this.seatZoomIn());
        this.elements.seatZoomOutBtn.addEventListener('click', () => this.seatZoomOut());
        this.elements.seatResetZoomBtn.addEventListener('click', () => this.resetSeatZoom());
        this.elements.seatCenterBtn.addEventListener('click', () => this.centerSeatView());
        
        // 특별 구역 설정 이벤트 리스너들
        document.getElementById('quick-set-entrance').addEventListener('click', () => this.setSpecialZone('entrance'));
        document.getElementById('quick-set-restroom').addEventListener('click', () => this.setSpecialZone('restroom'));
        document.getElementById('quick-clear-special').addEventListener('click', () => this.clearSpecialZones());
        
        // 빠른 작업 버튼 이벤트 리스너들
        document.getElementById('quick-clear-seats').addEventListener('click', () => this.quickClearSelectedSeats());
        document.getElementById('quick-assign-team').addEventListener('click', () => this.quickAssignTeamToSeats());
        document.getElementById('quick-save-layout').addEventListener('click', () => this.saveLayout());
        document.getElementById('quick-load-layout').addEventListener('click', () => this.loadLayout());
        document.getElementById('quick-clear-selection').addEventListener('click', () => this.clearSeatSelection());
        document.getElementById('quick-export-pdf').addEventListener('click', () => this.exportSeatLayoutToPDF());

        
        // 격자 설정 입력 필드 실시간 검증
        this.elements.gridCols.addEventListener('input', (e) => this.validateGridInput(e, 'cols'));
        this.elements.gridRows.addEventListener('input', (e) => this.validateGridInput(e, 'rows'));
        
        // 자리배치도 마우스 드래그 패닝 이벤트
        this.setupSeatPanning();
        
        // 팀 할당 팝업 이벤트
        this.elements.teamAssignCancel.addEventListener('click', () => this.hideTeamAssignModal());
        this.elements.teamAssignConfirm.addEventListener('click', () => this.confirmTeamAssign());
        this.elements.teamAssignModal.addEventListener('click', (e) => {
            if (e.target === this.elements.teamAssignModal) {
                this.hideTeamAssignModal();
            }
        });

        // 동적 입력 행 이벤트 (이벤트 위임)
        this.elements.inputRows.addEventListener('click', (e) => this.handleRowButtonClick(e));
        this.elements.inputRows.addEventListener('keypress', (e) => this.handleRowKeyPress(e));
        
        // 선택 모드 변경 이벤트
        document.querySelectorAll('input[name="selection-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.handleSelectionModeChange(e));
        });
        
        // 상호작용 모드 변경 이벤트
        document.querySelectorAll('input[name="interaction-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.handleInteractionModeChange(e));
        });
        
        // 할당 방식 변경 이벤트
        document.querySelectorAll('input[name="assign-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.handleAssignModeChange(e));
        });
        
        // 팀 드롭다운 변경 이벤트
        this.elements.teamDropdown.addEventListener('change', (e) => this.handleTeamDropdownChange(e));
        
        // 색상 모드 변경 이벤트
        const colorModeSelector = document.getElementById('seat-color-mode');
        if (colorModeSelector) {
            colorModeSelector.addEventListener('change', (e) => this.handleColorModeChange(e));
        }
        
        // 빠른 작업 버튼 이벤트
        const quickClearSeats = document.getElementById('quick-clear-seats');
        const quickAssignTeam = document.getElementById('quick-assign-team');
        const quickSaveLayout = document.getElementById('quick-save-layout');
        const quickLoadLayout = document.getElementById('quick-load-layout');
        const quickClearSelection = document.getElementById('quick-clear-selection');
        const quickExportPdf = document.getElementById('quick-export-pdf');
        
        if (quickClearSeats) {
            quickClearSeats.addEventListener('click', () => this.quickClearSelectedSeats());
        }
        if (quickAssignTeam) {
            quickAssignTeam.addEventListener('click', () => this.quickAssignTeamToSeats());
        }
        if (quickSaveLayout) {
            quickSaveLayout.addEventListener('click', () => this.saveLayout());
        }
        if (quickLoadLayout) {
            quickLoadLayout.addEventListener('click', () => this.loadLayout());
        }
        if (quickClearSelection) {
            quickClearSelection.addEventListener('click', () => this.clearSeatSelection());
        }
        if (quickExportPdf) {
            quickExportPdf.addEventListener('click', () => this.exportSeatLayoutToPDF());
        }
        
        // 전역 클릭 이벤트 (컨텍스트 메뉴 닫기)
        document.addEventListener('click', (e) => this.handleGlobalClick(e));
    }

    // 탭 전환 기능
    switchTab(tabName) {
        this.currentTab = tabName;
        
        // 탭 버튼 활성화 상태 변경
        this.elements.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // 탭 콘텐츠 표시/숨김
        this.elements.orgChartTab.classList.toggle('active', tabName === 'org-chart');
        this.elements.seatLayoutTab.classList.toggle('active', tabName === 'seat-layout');
        
        // 자리배치도 탭으로 전환 시 격자 업데이트
        if (tabName === 'seat-layout') {
            this.updateSeatGrid();
            this.updateTeamCardsList();
            this.updateColorLegend();
        }
    }

    // 자리배치도 격자 초기화
    initializeSeatGrid() {
        this.seatGrid = [];
        for (let row = 0; row < this.gridRows; row++) {
            this.seatGrid[row] = [];
            for (let col = 0; col < this.gridCols; col++) {
                this.seatGrid[row][col] = {
                    row: row,
                    col: col,
                    id: `seat-${row}-${col}`,
                    occupied: false,
                    person: null,
                    teamCard: null,
                    selected: false
                };
            }
        }
    }

    // 격자 설정 입력 필드 실시간 검증
    validateGridInput(event, type) {
        // 제한 없이 입력값 그대로 사용
    }

    // 격자 설정 적용
    applyGridSettings() {
        const newCols = parseInt(this.elements.gridCols.value);
        const newRows = parseInt(this.elements.gridRows.value);
        // 제한 없이 바로 적용
        this.gridCols = newCols;
        this.gridRows = newRows;
        this.initializeSeatGrid();
        this.updateSeatGrid();
        this.updateStatus(`격자가 ${this.gridCols}x${this.gridRows}로 변경되었습니다.`);
    }

    // 자리배치도 격자 업데이트
    updateSeatGrid() {
        const gridContainer = this.elements.seatGrid;
        gridContainer.innerHTML = '';
        
        // CSS 그리드 열 설정
        gridContainer.style.gridTemplateColumns = `repeat(${this.gridCols}, 1fr)`;
        
        // 좌석 생성
        for (let row = 0; row < this.gridRows; row++) {
            for (let col = 0; col < this.gridCols; col++) {
                const seat = this.seatGrid[row][col];
                const seatElement = this.createSeatElement(seat);
                gridContainer.appendChild(seatElement);
            }
        }
        
        // 좌석 선택 이벤트 설정
        this.setupSeatEvents();
        
        // 특별 구역 정보 복원
        this.specialZones.forEach((zoneType, seatId) => {
            this.updateSeatSpecialZone(seatId, zoneType);
        });
    }

    // 좌석 요소 생성
    createSeatElement(seat) {
        const seatElement = document.createElement('div');
        seatElement.className = 'seat';
        seatElement.dataset.row = seat.row;
        seatElement.dataset.col = seat.col;
        seatElement.dataset.id = seat.id;
        seatElement.dataset.seatId = seat.id; // 특별 구역 설정을 위한 속성 추가
        
        // 좌석 라벨 (좌표)
        const label = document.createElement('div');
        label.className = 'seat-label';
        label.textContent = `${seat.row + 1}-${seat.col + 1}`;
        seatElement.appendChild(label);
        
        // 좌석 상태에 따른 클래스 추가
        if (seat.occupied && seat.person) {
            seatElement.classList.add('occupied');
            
            // 개별 팀원 정보 표시
            const personDiv = document.createElement('div');
            personDiv.className = 'seat-person';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'person-name';
            nameDiv.textContent = seat.person.name;
            
            const positionDiv = document.createElement('div');
            positionDiv.className = 'person-position';
            positionDiv.textContent = seat.person.position;
            
            personDiv.appendChild(nameDiv);
            personDiv.appendChild(positionDiv);
            seatElement.appendChild(personDiv);
            
            // 드래그 가능하게 설정 (드래그 앤 드롭 모드일 때만)
            seatElement.draggable = (this.interactionMode === 'drag-drop');
            
        } else if (seat.teamCard) {
            seatElement.classList.add('team-assigned');
            const teamDiv = document.createElement('div');
            teamDiv.className = 'seat-person';
            teamDiv.textContent = '빈 좌석';
            seatElement.appendChild(teamDiv);
        }
        
        if (seat.selected) {
            seatElement.classList.add('selected');
        }
        
        // 색상 모드에 따른 색상 적용
        if (seat.occupied && seat.person && this.currentColorMode !== 'none') {
            this.applySeatColor(seatElement, seat.person);
        }
        
        // 특별 구역 정보가 있으면 적용
        const specialZoneType = this.specialZones.get(seat.id);
        if (specialZoneType) {
            seatElement.classList.add(`special-${specialZoneType}`);
            
            // 특별 구역 라벨 업데이트
            const labelElement = seatElement.querySelector('.seat-label');
            if (labelElement) {
                const zoneLabel = specialZoneType === 'entrance' ? '🚪 입구' : '🚽 화장실';
                labelElement.textContent = zoneLabel;
            }
            
            // 팀원 정보 숨김
            const personElement = seatElement.querySelector('.seat-person');
            if (personElement) {
                personElement.style.display = 'none';
            }
        }
        
        return seatElement;
    }

    // 좌석 이벤트 설정
    setupSeatEvents() {
        const seats = this.elements.seatGrid.querySelectorAll('.seat');
        
        seats.forEach(seat => {
            seat.addEventListener('click', (e) => this.handleSeatClick(e));
            seat.addEventListener('contextmenu', (e) => this.handleSeatContextMenu(e));
            seat.addEventListener('mousedown', (e) => this.handleSeatMouseDown(e));
            seat.addEventListener('mouseenter', (e) => this.handleSeatMouseEnter(e));
            seat.addEventListener('mouseup', (e) => this.handleSeatMouseUp(e));
            
            // 드래그 앤 드롭 이벤트
            seat.addEventListener('dragstart', (e) => this.handleSeatDragStart(e));
            seat.addEventListener('dragend', (e) => this.handleSeatDragEnd(e));
            seat.addEventListener('dragover', (e) => this.handleSeatDragOver(e));
            seat.addEventListener('drop', (e) => this.handleSeatDrop(e));
            seat.addEventListener('dragenter', (e) => this.handleSeatDragEnter(e));
            seat.addEventListener('dragleave', (e) => this.handleSeatDragLeave(e));
        });
        
        // 전역 마우스 이벤트
        document.addEventListener('mouseup', () => this.handleGlobalMouseUp());
    }

    // 좌석 클릭 처리
    handleSeatClick(event) {
        const seatElement = event.currentTarget;
        const row = parseInt(seatElement.dataset.row);
        const col = parseInt(seatElement.dataset.col);
        const seat = this.seatGrid[row][col];
        
        // 컨텍스트 메뉴 닫기
        this.hideContextMenu();
        
        const selectionMode = document.querySelector('input[name="selection-mode"]:checked').value;
        const interactionMode = document.querySelector('input[name="interaction-mode"]:checked').value;
        
        // 상호작용 모드에 따른 처리
        if (interactionMode === 'click-move' && seat.occupied && seat.person) {
            this.handleClickMove(seat, seatElement);
            return;
        }
        
        // 기본 좌석 선택 처리
        if (selectionMode === 'single') {
            // 단일 선택 모드
            this.clearSeatSelection();
            this.selectSeat(seat);
        } else {
            // 다중 선택 모드
            this.toggleSeatSelection(seat);
        }
        
        this.updateSeatInfo();
        this.updateSelectedSeatsCount();
    }

    // 좌석 마우스 다운 처리 (드래그 시작)
    handleSeatMouseDown(event) {
        const selectionMode = document.querySelector('input[name="selection-mode"]:checked').value;
        
        if (selectionMode === 'multiple') {
            event.preventDefault();
            this.isSelecting = true;
            const seatElement = event.currentTarget;
            const row = parseInt(seatElement.dataset.row);
            const col = parseInt(seatElement.dataset.col);
            this.dragStartSeat = { row, col };
        }
    }

    // 좌석 마우스 진입 처리 (드래그 중)
    handleSeatMouseEnter(event) {
        if (this.isSelecting && this.dragStartSeat) {
            const seatElement = event.currentTarget;
            const row = parseInt(seatElement.dataset.row);
            const col = parseInt(seatElement.dataset.col);
            
            this.selectSeatRange(this.dragStartSeat, { row, col });
        }
    }

    // 좌석 마우스 업 처리 (드래그 종료)
    handleSeatMouseUp(event) {
        this.isSelecting = false;
        this.dragStartSeat = null;
        this.updateSeatInfo();
        this.updateSelectedSeatsCount();
    }

    // 전역 마우스 업 처리
    handleGlobalMouseUp() {
        this.isSelecting = false;
        this.dragStartSeat = null;
    }

    // 드래그 시작 처리
    handleSeatDragStart(event) {
        // 드래그 앤 드롭 모드가 아니면 드래그 방지
        if (this.interactionMode !== 'drag-drop') {
            event.preventDefault();
            return;
        }
        
        const seatElement = event.currentTarget;
        const row = parseInt(seatElement.dataset.row);
        const col = parseInt(seatElement.dataset.col);
        const seat = this.seatGrid[row][col];
        
        // 팀원이 할당된 좌석만 드래그 가능
        if (!seat.occupied || !seat.person) {
            event.preventDefault();
            return;
        }
        
        seatElement.classList.add('dragging');
        event.dataTransfer.setData('text/plain', JSON.stringify({
            row: row,
            col: col,
            seatId: seat.id
        }));
        
        this.updateStatus(`${seat.person.name}님을 이동 중...`);
    }

    // 드래그 종료 처리
    handleSeatDragEnd(event) {
        const seatElement = event.currentTarget;
        seatElement.classList.remove('dragging');
        
        // 모든 드롭 표시 제거
        this.elements.seatGrid.querySelectorAll('.seat').forEach(seat => {
            seat.classList.remove('drop-target', 'drop-invalid');
        });
    }

    // 드래그 오버 처리
    handleSeatDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    // 드래그 진입 처리
    handleSeatDragEnter(event) {
        const seatElement = event.currentTarget;
        const row = parseInt(seatElement.dataset.row);
        const col = parseInt(seatElement.dataset.col);
        const seat = this.seatGrid[row][col];
        
        // 드롭 가능한 좌석인지 확인
        if (this.canDropOnSeat(seat)) {
            seatElement.classList.add('drop-target');
        } else {
            seatElement.classList.add('drop-invalid');
        }
    }

    // 드래그 떠남 처리
    handleSeatDragLeave(event) {
        const seatElement = event.currentTarget;
        seatElement.classList.remove('drop-target', 'drop-invalid');
    }

    // 드롭 처리
    handleSeatDrop(event) {
        event.preventDefault();
        
        const targetSeatElement = event.currentTarget;
        const targetRow = parseInt(targetSeatElement.dataset.row);
        const targetCol = parseInt(targetSeatElement.dataset.col);
        const targetSeat = this.seatGrid[targetRow][targetCol];
        
        try {
            const dragData = JSON.parse(event.dataTransfer.getData('text/plain'));
            const sourceSeat = this.seatGrid[dragData.row][dragData.col];
            
            // 드롭 가능한지 확인
            if (!this.canDropOnSeat(targetSeat)) {
                this.updateStatus('해당 좌석으로 이동할 수 없습니다.');
                return;
            }
            
            // 좌석 교체 실행
            this.swapSeats(sourceSeat, targetSeat);
            
            this.updateStatus(`${sourceSeat.person ? sourceSeat.person.name : '팀원'}님이 이동했습니다.`);
            
        } catch (error) {
            console.error('드롭 처리 오류:', error);
            this.updateStatus('좌석 이동 중 오류가 발생했습니다.');
        }
    }

    // 드롭 가능한 좌석인지 확인
    canDropOnSeat(targetSeat) {
        // 같은 팀 카드 내에서만 이동 가능
        return targetSeat.teamCard !== null;
    }

    // 좌석 교체
    swapSeats(seat1, seat2) {
        // 두 좌석의 팀원 정보 교체
        const tempPerson = seat1.person;
        const tempOccupied = seat1.occupied;
        
        seat1.person = seat2.person;
        seat1.occupied = seat2.occupied;
        
        seat2.person = tempPerson;
        seat2.occupied = tempOccupied;
        
        // 좌석 그리드 재렌더링
        this.updateSeatGrid();
    }

    // 클릭 이동 처리
    handleClickMove(seat, seatElement) {
        if (!this.clickMoveSource) {
            // 첫 번째 클릭: 이동할 좌석 선택
            this.clickMoveSource = seat;
            this.clearClickMoveVisuals();
            seatElement.classList.add('click-source');
            this.updateStatus(`${seat.person.name}님을 선택했습니다. 이동할 좌석을 클릭하세요.`);
            
            // 같은 팀 카드 내 빈 좌석들 하이라이트
            this.highlightMoveTargets(seat.teamCard);
        } else {
            // 두 번째 클릭: 이동 실행
            if (seat === this.clickMoveSource) {
                // 같은 좌석 클릭 시 선택 해제
                this.clearClickMoveState();
                this.updateStatus('이동이 취소되었습니다.');
                return;
            }
            
            if (seat.teamCard === this.clickMoveSource.teamCard) {
                // 같은 팀 카드 내에서 이동
                this.swapSeats(this.clickMoveSource, seat);
                this.clearClickMoveState();
                this.updateStatus(`${this.clickMoveSource.person ? this.clickMoveSource.person.name : '팀원'}님이 이동했습니다.`);
            } else {
                this.updateStatus('같은 팀 내에서만 이동할 수 있습니다.');
            }
        }
    }

    // 클릭 이동 상태 초기화
    clearClickMoveState() {
        this.clickMoveSource = null;
        this.clearClickMoveVisuals();
    }

    // 클릭 이동 시각적 표시 제거
    clearClickMoveVisuals() {
        this.elements.seatGrid.querySelectorAll('.seat').forEach(seat => {
            seat.classList.remove('click-source', 'click-move-target');
        });
    }

    // 이동 가능한 좌석들 하이라이트
    highlightMoveTargets(teamCard) {
        if (!teamCard) return;
        
        teamCard.seats.forEach(seatId => {
            const [row, col] = seatId.split('-').slice(1).map(Number);
            const seat = this.seatGrid[row][col];
            const seatElement = document.querySelector(`[data-id="${seat.id}"]`);
            
            if (seatElement && seat !== this.clickMoveSource) {
                seatElement.classList.add('click-move-target');
            }
        });
    }

    // 우클릭 컨텍스트 메뉴 처리
    handleSeatContextMenu(event) {
        if (this.interactionMode !== 'context-menu') return;
        
        event.preventDefault();
        
        const seatElement = event.currentTarget;
        const row = parseInt(seatElement.dataset.row);
        const col = parseInt(seatElement.dataset.col);
        const seat = this.seatGrid[row][col];
        
        this.showContextMenu(event.pageX, event.pageY, seat);
    }

    // 컨텍스트 메뉴 표시
    showContextMenu(x, y, seat) {
        this.hideContextMenu();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        
        // 마우스 위치에 바로 표시
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        
        const menuItems = [];
        
        if (seat.occupied && seat.person) {
            menuItems.push({
                text: `📝 ${seat.person.name} 정보 편집`,
                action: () => this.editPersonInSeat(seat)
            });
            menuItems.push({
                text: `🔄 ${seat.person.name} 이동`,
                action: () => this.startPersonMove(seat)
            });
            menuItems.push({
                text: `❌ 좌석 비우기`,
                action: () => this.clearSeatPerson(seat)
            });
        } else if (seat.teamCard) {
            menuItems.push({
                text: `👤 팀원 배치`,
                action: () => this.assignPersonToSeat(seat)
            });
        }
        
        if (seat.teamCard) {
            menuItems.push({
                text: `🏷️ 팀 정보 보기`,
                action: () => this.showTeamInfo(seat.teamCard)
            });
        }
        
        menuItems.push({
            text: `📍 좌석 정보 (${seat.row + 1}-${seat.col + 1})`,
            action: () => this.showSeatInfo(seat)
        });
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.textContent = item.text;
            menuItem.addEventListener('click', () => {
                item.action();
                this.hideContextMenu();
            });
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        this.contextMenu = menu;
    }

    // 컨텍스트 메뉴 숨기기
    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
    }

    // 전역 클릭 처리
    handleGlobalClick(event) {
        if (this.contextMenu && !this.contextMenu.contains(event.target)) {
            this.hideContextMenu();
        }
    }

    // 컨텍스트 메뉴 액션들
    editPersonInSeat(seat) {
        const person = seat.person;
        const newName = prompt(`이름을 수정하세요:`, person.name);
        if (newName && newName.trim()) {
            person.name = newName.trim();
            this.updateSeatGrid();
            this.updateStatus(`${person.name}님의 정보가 수정되었습니다.`);
        }
    }

    startPersonMove(seat) {
        this.interactionMode = 'click-move';
        document.querySelector('input[name="interaction-mode"][value="click-move"]').checked = true;
        this.clickMoveSource = seat;
        this.clearClickMoveVisuals();
        document.querySelector(`[data-id="${seat.id}"]`).classList.add('click-source');
        this.highlightMoveTargets(seat.teamCard);
        this.updateStatus(`${seat.person.name}님을 이동할 좌석을 클릭하세요.`);
    }

    clearSeatPerson(seat) {
        if (confirm(`${seat.person.name}님을 좌석에서 제거하시겠습니까?`)) {
            seat.person = null;
            seat.occupied = false;
            seat.teamCard = null; // 팀 할당 정보도 함께 제거
            this.updateSeatGrid();
            this.updateStatus('좌석이 비워졌습니다.');
        }
    }

    assignPersonToSeat(seat) {
        if (!seat.teamCard) return;
        
        const availableMembers = seat.teamCard.members.filter(member => 
            !this.isPersonAssignedToSeat(member)
        );
        
        if (availableMembers.length === 0) {
            alert('배치할 수 있는 팀원이 없습니다.');
            return;
        }
        
        const memberNames = availableMembers.map(m => m.name);
        const selectedName = prompt(`배치할 팀원을 선택하세요:\n${memberNames.join('\n')}`);
        
        const selectedMember = availableMembers.find(m => m.name === selectedName);
        if (selectedMember) {
            seat.person = selectedMember;
            seat.occupied = true;
            this.updateSeatGrid();
            this.updateStatus(`${selectedMember.name}님이 좌석에 배치되었습니다.`);
        }
    }

    isPersonAssignedToSeat(person) {
        return this.seatGrid.some(row => 
            row.some(seat => seat.person && seat.person.id === person.id)
        );
    }

    showTeamInfo(teamCard) {
        const memberNames = teamCard.members.map(m => m.name).join(', ');
        alert(`팀: ${teamCard.name}\n팀원: ${memberNames}\n좌석 수: ${teamCard.seats.length}`);
    }

    showSeatInfo(seat) {
        const seatInfo = this.elements.seatInfo;
        
        if (!seat) {
            seatInfo.innerHTML = '<p class="no-selection">좌석을 선택하세요</p>';
            return;
        }

        let infoHTML = `
            <div class="seat-info-item">
                <span class="seat-info-label">좌석:</span>
                <span class="seat-info-value">${seat.row + 1}-${seat.col + 1}</span>
            </div>
        `;

        // 특별 구역 정보 추가
        const specialZoneType = this.specialZones.get(seat.id);
        if (specialZoneType) {
            const zoneName = specialZoneType === 'entrance' ? '🚪 입구 구역' : '🚽 화장실 구역';
            infoHTML += `
                <div class="seat-info-item">
                    <span class="seat-info-label">특별 구역:</span>
                    <span class="seat-info-value">${zoneName}</span>
                </div>
            `;
        }

        // 기존 정보들 추가
        if (seat.person) {
            infoHTML += `
                <div class="seat-info-item">
                    <span class="seat-info-label">이름:</span>
                    <span class="seat-info-value">${seat.person.name}</span>
                </div>
                <div class="seat-info-item">
                    <span class="seat-info-label">직급:</span>
                    <span class="seat-info-value">${seat.person.position}</span>
                </div>
                <div class="seat-info-item">
                    <span class="seat-info-label">부서:</span>
                    <span class="seat-info-value">${seat.person.department}</span>
                </div>
            `;
        } else {
            infoHTML += `
                <div class="seat-info-item">
                    <span class="seat-info-label">상태:</span>
                    <span class="seat-info-value">빈 좌석</span>
                </div>
            `;
        }

        seatInfo.innerHTML = infoHTML;
    }

    // 좌석 선택
    selectSeat(seat) {
        seat.selected = true;
        this.selectedSeats.add(seat.id);
        this.updateSeatVisual(seat);
    }

    // 좌석 선택 토글
    toggleSeatSelection(seat) {
        if (seat.selected) {
            seat.selected = false;
            this.selectedSeats.delete(seat.id);
        } else {
            seat.selected = true;
            this.selectedSeats.add(seat.id);
        }

        this.updateSeatVisual(seat);
    }

    // 좌석 범위 선택
    selectSeatRange(start, end) {
        this.clearSeatSelection();
        
        const minRow = Math.min(start.row, end.row);
        const maxRow = Math.max(start.row, end.row);
        const minCol = Math.min(start.col, end.col);
        const maxCol = Math.max(start.col, end.col);
        
        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                const seat = this.seatGrid[row][col];
                this.selectSeat(seat);
            }
        }
    }

    // 좌석 선택 해제
    clearSeatSelection() {
        this.selectedSeats.clear();
        this.seatGrid.forEach(row => {
            row.forEach(seat => {
                seat.selected = false;
                this.updateSeatVisual(seat);
            });
        });
        this.updateSeatInfo();
        this.updateSelectedSeatsCount();
    }

    // 좌석 시각적 업데이트
    updateSeatVisual(seat) {
        const seatElement = document.querySelector(`[data-id="${seat.id}"]`);
        if (seatElement) {
            seatElement.classList.toggle('selected', seat.selected);
        }
    }

    // 선택 모드 변경 처리
    handleSelectionModeChange(event) {
        this.clearSeatSelection();
        const mode = event.target.value;
        this.updateStatus(`선택 모드가 ${mode === 'single' ? '단일' : '다중'} 모드로 변경되었습니다.`);
    }

    // 상호작용 모드 변경 처리
    handleInteractionModeChange(event) {
        this.interactionMode = event.target.value;
        this.clearClickMoveState();
        this.hideContextMenu();
        
        // 배치 변경 모드일 때는 좌석 선택 모드를 단일 선택으로 고정
        if (this.interactionMode !== 'selection-only') {
            const singleSelectionRadio = document.querySelector('input[name="selection-mode"][value="single"]');
            if (singleSelectionRadio) {
                singleSelectionRadio.checked = true;
            }
            // 좌석 선택 모드 라디오 버튼들 비활성화
            document.querySelectorAll('input[name="selection-mode"]').forEach(radio => {
                radio.disabled = true;
            });
        } else {
            // 좌석 선택 모드 라디오 버튼들 활성화
            document.querySelectorAll('input[name="selection-mode"]').forEach(radio => {
                radio.disabled = false;
            });
        }
        
        const modeNames = {
            'selection-only': '좌석 선택만',
            'drag-drop': '드래그 앤 드롭',
            'click-move': '클릭 이동',
            'context-menu': '상세 편집'
        };
        
        // 좌석 그리드 재설정
        this.updateSeatGrid();
        
        this.updateStatus(`배치 변경 모드가 ${modeNames[this.interactionMode]}로 변경되었습니다.`);
        
        // 상세 편집 모드일 때 안내 메시지 추가
        if (this.interactionMode === 'context-menu') {
            this.updateStatus('🔧 상세 편집 모드: 좌석에서 우클릭하여 편집 메뉴를 사용하세요.');
        }
    }

    // 좌석 정보 업데이트
    updateSeatInfo() {
        const selectedSeatsArray = Array.from(this.selectedSeats);
        const seatInfoDiv = this.elements.seatInfo;
        
        if (selectedSeatsArray.length === 0) {
            seatInfoDiv.innerHTML = '<p class="no-selection">좌석을 선택하세요</p>';
            return;
        }
        
        let infoHTML = '<div class="seat-info-content">';
        
        if (selectedSeatsArray.length === 1) {
            const seatId = selectedSeatsArray[0];
            const [row, col] = seatId.split('-').slice(1).map(Number);
            const seat = this.seatGrid[row][col];
            
            infoHTML += `<div class="seat-info-item">
                <span class="seat-info-label">좌석 위치:</span>
                <span class="seat-info-value">${row + 1}행 ${col + 1}열</span>
            </div>`;
            
            if (seat.person) {
                infoHTML += `<div class="seat-info-item">
                    <span class="seat-info-label">사용자:</span>
                    <span class="seat-info-value">${seat.person.name} (${seat.person.position})</span>
                </div>`;
            }
            
            if (seat.teamCard) {
                infoHTML += `<div class="seat-info-item">
                    <span class="seat-info-label">팀:</span>
                    <span class="seat-info-value">${seat.teamCard.name}</span>
                </div>`;
            }
        } else {
            infoHTML += `<div class="seat-info-item">
                <span class="seat-info-label">선택된 좌석:</span>
                <span class="seat-info-value">${selectedSeatsArray.length}개</span>
            </div>`;
        }
        
        infoHTML += '</div>';
        seatInfoDiv.innerHTML = infoHTML;
    }

    // 선택된 좌석 수 업데이트
    updateSelectedSeatsCount() {
        this.elements.selectedSeatsCount.textContent = this.selectedSeats.size;
        
        // 좌석 관리 패널의 선택된 좌석 표시도 업데이트
        const selectedSeatsDisplay = document.getElementById('selected-seats-display');
        if (selectedSeatsDisplay) {
            selectedSeatsDisplay.textContent = `${this.selectedSeats.size}개 선택됨`;
        }
    }

    // 빠른 작업: 선택된 좌석 비우기
    quickClearSelectedSeats() {
        if (this.selectedSeats.size === 0) {
            alert('선택된 좌석이 없습니다.');
            return;
        }
        
        const proceed = confirm(`선택된 ${this.selectedSeats.size}개 좌석을 모두 비우시겠습니까?`);
        if (!proceed) return;
        
        this.selectedSeats.forEach(seatId => {
            const [row, col] = seatId.split('-').slice(1).map(Number);
            const seat = this.seatGrid[row][col];
            seat.person = null;
            seat.occupied = false;
            seat.teamCard = null;
        });
        
        this.updateSeatGrid();
        this.clearSeatSelection();
        this.updateStatus(`${this.selectedSeats.size}개 좌석이 비워졌습니다.`);
    }

    // 빠른 작업: 선택된 좌석에 팀 할당
    quickAssignTeamToSeats() {
        if (this.selectedSeats.size === 0) {
            alert('선택된 좌석이 없습니다.');
            return;
        }
        
        this.showTeamAssignModal();
    }

    // 팀 할당 모달 표시
    showTeamAssignModal() {
        if (this.selectedSeats.size === 0) {
            alert('좌석을 먼저 선택해주세요.');
            return;
        }
        
        this.updateTeamDropdown();
        this.updateTeamMembersList();
        this.updateSelectedSeatsCount();
        this.updateSeatTeamMatch();
        this.elements.teamAssignModal.classList.add('active');
    }

    // 팀 할당 모달 숨김
    hideTeamAssignModal() {
        this.elements.teamAssignModal.classList.remove('active');
        this.elements.teamDropdown.value = '';
        this.elements.customTeamNameInput.value = '';
        this.elements.teamMemberCount.textContent = '0';
        this.elements.teamMembersPreview.innerHTML = '';
        this.elements.seatTeamMatch.textContent = '';
    }

    // 팀 드롭다운 업데이트
    updateTeamDropdown() {
        const dropdown = this.elements.teamDropdown;
        dropdown.innerHTML = '<option value="">팀을 선택하세요</option>';
        
        // 부서별로 팀 그룹화
        const teamsByDepartment = this.getTeamsByDepartment();
        
        Object.keys(teamsByDepartment).forEach(department => {
            const members = teamsByDepartment[department];
            if (members.length > 0) {
                const option = document.createElement('option');
                option.value = department;
                option.textContent = `${department} (${members.length}명)`;
                dropdown.appendChild(option);
            }
        });
    }

    // 부서별 팀 가져오기
    getTeamsByDepartment() {
        const teams = {};
        
        this.people.forEach(person => {
            if (person.department) {
                if (!teams[person.department]) {
                    teams[person.department] = [];
                }
                teams[person.department].push(person);
            }
        });
        
        return teams;
    }

    // 할당 방식 변경 처리
    handleAssignModeChange(event) {
        const mode = event.target.value;
        
        if (mode === 'team') {
            this.elements.teamModeSection.style.display = 'block';
            this.elements.individualModeSection.style.display = 'none';
        } else {
            this.elements.teamModeSection.style.display = 'none';
            this.elements.individualModeSection.style.display = 'block';
        }
        
        this.updateSeatTeamMatch();
    }

    // 팀 드롭다운 변경 처리
    handleTeamDropdownChange(event) {
        const selectedDepartment = event.target.value;
        
        if (selectedDepartment) {
            const teams = this.getTeamsByDepartment();
            const teamMembers = teams[selectedDepartment] || [];
            
            this.elements.teamMemberCount.textContent = teamMembers.length;
            
            // 팀원 미리보기 업데이트
            this.elements.teamMembersPreview.innerHTML = '';
            teamMembers.forEach(member => {
                const tag = document.createElement('div');
                tag.className = 'team-member-tag';
                tag.textContent = `${member.name} (${member.position})`;
                this.elements.teamMembersPreview.appendChild(tag);
            });
        } else {
            this.elements.teamMemberCount.textContent = '0';
            this.elements.teamMembersPreview.innerHTML = '';
        }
        
        this.updateSeatTeamMatch();
    }

    // 색상 모드 변경 핸들러
    handleColorModeChange(event) {
        const colorMode = event.target.value;
        this.currentColorMode = colorMode;
        
        // 모든 좌석의 색상 클래스 제거
        this.elements.seatGrid.querySelectorAll('.seat').forEach(seatElement => {
            this.removeSeatColorClasses(seatElement);
        });
        
        // 새로운 색상 모드 적용
        this.applySeatColors();
        
        // 색상 범례 업데이트
        this.updateColorLegend();
        
        this.updateStatus(`좌석 색상이 ${this.getColorModeDisplayName(colorMode)}로 변경되었습니다.`);
    }

    // 좌석 색상 클래스 제거
    removeSeatColorClasses(seatElement) {
        seatElement.classList.remove(
            'position-ceo', 'position-이사', 'position-본부장', 'position-실장', 'position-팀장',
            'position-파트장', 'position-과장', 'position-대리', 'position-주임', 'position-사원',
            'position-수습', 'position-매니저', 'position-시니어',
            'department-전략기획실', 'department-경영관리실', 'department-고객지원부',
            'department-물류지원부', 'department-브랜드사업부', 'department-브랜드사업부M'
        );
    }

    // 좌석 색상 적용
    applySeatColors() {
        if (this.currentColorMode === 'none') return;
        
        this.elements.seatGrid.querySelectorAll('.seat').forEach(seatElement => {
            const row = parseInt(seatElement.dataset.row);
            const col = parseInt(seatElement.dataset.col);
            const seat = this.seatGrid[row][col];
            
            if (seat.occupied && seat.person) {
                this.applySeatColor(seatElement, seat.person);
            }
        });
    }

    // 개별 좌석 색상 적용
    applySeatColor(seatElement, person) {
        if (this.currentColorMode === 'position') {
            this.applyPositionColor(seatElement, person.position);
        } else if (this.currentColorMode === 'department') {
            this.applyDepartmentColor(seatElement, person.department);
        }
    }

    // 직급별 색상 적용
    applyPositionColor(seatElement, position) {
        const positionClass = this.getPositionClass(position);
        if (positionClass) {
            seatElement.classList.add(positionClass);
        }
    }

    // 부서별 색상 적용
    applyDepartmentColor(seatElement, department) {
        const departmentClass = this.getDepartmentClass(department);
        if (departmentClass) {
            seatElement.classList.add(departmentClass);
        }
    }



    // 직급 클래스명 생성
    getPositionClass(position) {
        if (!position) return null;
        
        // 직급명 정규화
        const normalizedPosition = position.replace(/[()]/g, '').trim();
        return `position-${normalizedPosition}`;
    }

    // 부서 클래스명 생성
    getDepartmentClass(department) {
        if (!department) return null;
        
        // 부서명 정규화 (괄호 제거)
        const normalizedDepartment = department.replace(/[()]/g, '').trim();
        return `department-${normalizedDepartment}`;
    }

    // 색상 모드 표시명
    getColorModeDisplayName(mode) {
        const modeNames = {
            'none': '색상 없음',
            'position': '직급별 색상',
            'department': '부서별 색상'
        };
        return modeNames[mode] || mode;
    }



    // 색상 범례 업데이트 (간소화)
    updateColorLegend() {
        // 색상 범례는 드롭다운으로 변경되어 더 이상 필요하지 않음
        return;
    }

    // 범례 데이터 생성
    getLegendData() {
        if (this.currentColorMode === 'position') {
            return [
                { label: 'CEO', color: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)' },
                { label: '이사', color: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)' },
                { label: '본부장', color: 'linear-gradient(135deg, #45b7d1 0%, #96c93d 100%)' },
                { label: '실장', color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
                { label: '팀장', color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
                { label: '파트장', color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
                { label: '과장', color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
                { label: '대리', color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
                { label: '주임', color: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
                { label: '사원', color: 'linear-gradient(135deg, #a8caba 0%, #5d4e75 100%)' },
                { label: '수습', color: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)' },
                { label: '매니저', color: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)' },
                { label: '시니어', color: 'linear-gradient(135deg, #fdbb2d 0%, #22c1c3 100%)' }
            ];
        } else if (this.currentColorMode === 'department') {
            return [
                { label: '전략기획실', color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
                { label: '경영관리실', color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
                { label: '고객지원부', color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
                { label: '물류지원부', color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
                { label: '브랜드사업부', color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
                { label: '브랜드사업부(M)', color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }
            ];
        }
        
        return [];
    }

    // 좌석 수와 팀원 수 비교
    updateSeatTeamMatch() {
        const seatCount = this.selectedSeats.size;
        const assignMode = document.querySelector('input[name="assign-mode"]:checked').value;
        
        let memberCount = 0;
        
        if (assignMode === 'team') {
            memberCount = parseInt(this.elements.teamMemberCount.textContent);
        } else {
            memberCount = this.elements.teamMembersList.querySelectorAll('input:checked').length;
        }
        
        const matchElement = this.elements.seatTeamMatch;
        
        if (memberCount === 0) {
            matchElement.textContent = '';
            matchElement.className = 'seat-team-match';
        } else if (seatCount === memberCount) {
            matchElement.textContent = `✅ 좌석 수와 팀원 수가 일치합니다`;
            matchElement.className = 'seat-team-match match';
        } else if (seatCount > memberCount) {
            matchElement.textContent = `⚠️ 좌석이 ${seatCount - memberCount}개 더 많습니다`;
            matchElement.className = 'seat-team-match no-match';
        } else {
            matchElement.textContent = `❌ 팀원이 ${memberCount - seatCount}명 더 많습니다`;
            matchElement.className = 'seat-team-match no-match';
        }
    }

    // 팀원 목록 업데이트
    updateTeamMembersList() {
        const membersList = this.elements.teamMembersList;
        membersList.innerHTML = '';
        
        this.people.forEach(person => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'team-member-item';
            
            memberDiv.innerHTML = `
                <input type="checkbox" id="member-${person.id}" value="${person.id}">
                <div class="team-member-info">
                    <div class="team-member-name">${person.name}</div>
                    <div class="team-member-position">${person.position} - ${person.department}</div>
                </div>
            `;
            
            // 체크박스 변경 이벤트
            const checkbox = memberDiv.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => this.updateSeatTeamMatch());
            
            membersList.appendChild(memberDiv);
        });
    }

    // 팀 할당 확인
    confirmTeamAssign() {
        const assignMode = document.querySelector('input[name="assign-mode"]:checked').value;
        let teamName, selectedMembers;
        
        if (assignMode === 'team') {
            // 팀 단위 할당
            const selectedDepartment = this.elements.teamDropdown.value;
            if (!selectedDepartment) {
                alert('팀을 선택해주세요.');
                return;
            }
            
            teamName = selectedDepartment;
            const teams = this.getTeamsByDepartment();
            selectedMembers = teams[selectedDepartment] || [];
            
            if (selectedMembers.length === 0) {
                alert('선택된 팀에 팀원이 없습니다.');
                return;
            }
            
            // 좌석 수와 팀원 수 확인
            if (this.selectedSeats.size !== selectedMembers.length) {
                const proceed = confirm(
                    `좌석 수(${this.selectedSeats.size})와 팀원 수(${selectedMembers.length})가 일치하지 않습니다.\n` +
                    `그래도 할당하시겠습니까?`
                );
                if (!proceed) return;
            }
            
        } else {
            // 개별 팀원 할당
            teamName = this.elements.customTeamNameInput.value.trim();
            if (!teamName) {
                alert('팀명을 입력해주세요.');
                return;
            }
            
            selectedMembers = Array.from(this.elements.teamMembersList.querySelectorAll('input:checked'))
                .map(checkbox => this.people.find(p => p.id === checkbox.value));
            
            if (selectedMembers.length === 0) {
                alert('팀원을 선택해주세요.');
                return;
            }
        }
        
        // 팀 카드 생성
        const teamCard = {
            id: this.generateId(),
            name: teamName,
            members: selectedMembers,
            seats: Array.from(this.selectedSeats),
            assignMode: assignMode
        };
        
        this.teamCards.push(teamCard);
        
        // 선택된 좌석에 팀원 개별 할당
        const selectedSeatsArray = Array.from(this.selectedSeats);
        selectedSeatsArray.forEach((seatId, index) => {
            const [row, col] = seatId.split('-').slice(1).map(Number);
            const seat = this.seatGrid[row][col];
            seat.teamCard = teamCard;
            
            // 팀원을 좌석에 개별 할당 (순서대로)
            if (index < selectedMembers.length) {
                seat.person = selectedMembers[index];
                seat.occupied = true;
            }
        });
        
        this.updateSeatGrid();
        this.updateTeamCardsList();
        this.clearSeatSelection();
        this.hideTeamAssignModal();
        
        // 특별 구역 정보 복원
        this.specialZones.forEach((zoneType, seatId) => {
            this.updateSeatSpecialZone(seatId, zoneType);
        });
        
        // 색상 모드가 활성화된 경우 색상 재적용
        if (this.currentColorMode !== 'none') {
            this.applySeatColors();
        }
        
        this.updateStatus(`팀 "${teamName}"이 ${teamCard.seats.length}개 좌석에 할당되었습니다.`);
    }

    // 팀 카드 목록 업데이트
    updateTeamCardsList() {
        const cardsList = this.elements.teamCardsList;
        cardsList.innerHTML = '';
        
        this.teamCards.forEach(teamCard => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'team-card';
            cardDiv.dataset.teamId = teamCard.id;
            
            const memberNames = teamCard.members.map(m => m.name).join(', ');
            
            cardDiv.innerHTML = `
                <div class="team-card-header">
                    <div class="team-card-name">${teamCard.name}</div>
                    <div class="team-card-count">${teamCard.seats.length}석</div>
                </div>
                <div class="team-card-members">${memberNames}</div>
            `;
            
            cardDiv.addEventListener('click', () => this.selectTeamCard(teamCard));
            cardsList.appendChild(cardDiv);
        });
    }

    // 팀 카드 선택
    selectTeamCard(teamCard) {
        // 기존 선택 해제
        this.clearSeatSelection();
        
        // 팀 카드의 좌석들 선택
        teamCard.seats.forEach(seatId => {
            const [row, col] = seatId.split('-').slice(1).map(Number);
            const seat = this.seatGrid[row][col];
            this.selectSeat(seat);
        });
        
        this.updateSeatInfo();
        this.updateSelectedSeatsCount();
        
        // 팀 카드 시각적 선택
        document.querySelectorAll('.team-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-team-id="${teamCard.id}"]`).classList.add('selected');
    }

    // 자리배치도 확대/축소/이동 기능들
    seatZoomIn() {
        this.seatZoom = Math.min(this.seatZoom * 1.2, 2.5);
        this.applySeatTransform();
        this.updateStatus(`확대: ${Math.round(this.seatZoom * 100)}%`);
    }

    seatZoomOut() {
        this.seatZoom = Math.max(this.seatZoom / 1.2, 0.3);
        this.applySeatTransform();
        this.updateStatus(`축소: ${Math.round(this.seatZoom * 100)}%`);
    }

    resetSeatZoom() {
        this.seatZoom = 1;
        this.seatPanX = 0;
        this.seatPanY = 0;
        this.applySeatTransform();
        this.updateStatus('원래 크기로 복원되었습니다.');
    }

    centerSeatView() {
        this.seatPanX = 0;
        this.seatPanY = 0;
        this.applySeatTransform();
        this.updateStatus('중앙으로 정렬되었습니다.');
    }

    applySeatTransform() {
        const gridContainer = this.elements.seatGrid;
        const wrapper = gridContainer.parentElement;
        
        if (!wrapper) return;
        
        // 컨테이너 크기 계산
        const wrapperRect = wrapper.getBoundingClientRect();
        const gridRect = gridContainer.getBoundingClientRect();
        
        // 확대/축소 적용
        gridContainer.style.transform = `scale(${this.seatZoom})`;
        
        // 중앙 정렬을 위한 위치 조정
        const scaledWidth = gridRect.width * this.seatZoom;
        const scaledHeight = gridRect.height * this.seatZoom;
        
        // 패닝 제한 (창을 벗어나지 않도록)
        const maxPanX = Math.max(0, (scaledWidth - wrapperRect.width) / 2);
        const maxPanY = Math.max(0, (scaledHeight - wrapperRect.height) / 2);
        
        this.seatPanX = Math.max(-maxPanX, Math.min(maxPanX, this.seatPanX));
        this.seatPanY = Math.max(-maxPanY, Math.min(maxPanY, this.seatPanY));
        
        // 최종 변환 적용
        gridContainer.style.transform = `scale(${this.seatZoom}) translate(${this.seatPanX}px, ${this.seatPanY}px)`;
    }

    setupSeatPanning() {
        const wrapper = this.elements.seatGrid.parentElement;
        if (!wrapper) return;

        let isPanning = false;
        let startX = 0;
        let startY = 0;
        let startPanX = 0;
        let startPanY = 0;

        wrapper.addEventListener('mousedown', (e) => {
            // 좌석 선택 모드가 아닐 때만 패닝 허용
            const interactionMode = document.querySelector('input[name="interaction-mode"]:checked').value;
            if (interactionMode !== 'selection-only') return;
            
            // 좌석 클릭이 아닐 때만 패닝 허용
            if (e.target.closest('.seat')) return;
            
            isPanning = true;
            startX = e.clientX;
            startY = e.clientY;
            startPanX = this.seatPanX;
            startPanY = this.seatPanY;
            
            wrapper.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            this.seatPanX = startPanX + deltaX;
            this.seatPanY = startPanY + deltaY;
            
            this.applySeatTransform();
        });

        document.addEventListener('mouseup', () => {
            if (isPanning) {
                isPanning = false;
                wrapper.style.cursor = 'grab';
            }
        });

        // 마우스 휠 줌 기능
        wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.seatZoom = Math.max(0.3, Math.min(2.5, this.seatZoom * zoomFactor));
            
            this.applySeatTransform();
            this.updateStatus(`줌: ${Math.round(this.seatZoom * 100)}%`);
        });

        // 초기 커서 설정
        wrapper.style.cursor = 'grab';
    }

    // 레이아웃 저장/불러오기
    saveLayout() {
        const layoutData = {
            gridCols: this.gridCols,
            gridRows: this.gridRows,
            seatGrid: this.seatGrid,
            teamCards: this.teamCards,
            specialZones: Array.from(this.specialZones.entries()) // 특별 구역 정보 포함
        };
        
        const dataStr = JSON.stringify(layoutData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `seat_layout_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        this.updateStatus('💾 자리배치도가 저장되었습니다!');
    }

    loadLayout() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const layoutData = JSON.parse(e.target.result);
                    
                    this.gridCols = layoutData.gridCols;
                    this.gridRows = layoutData.gridRows;
                    this.seatGrid = layoutData.seatGrid;
                    this.teamCards = layoutData.teamCards || [];
                    
                    // 특별 구역 데이터 복원
                    if (layoutData.specialZones) {
                        this.specialZones = new Map(layoutData.specialZones);
                    } else {
                        this.specialZones.clear();
                    }
                    
                    this.elements.gridCols.value = this.gridCols;
                    this.elements.gridRows.value = this.gridRows;
                    
                    this.updateSeatGrid();
                    this.updateTeamCardsList();
                    
                    // 특별 구역 시각적 복원
                    this.specialZones.forEach((zoneType, seatId) => {
                        this.updateSeatSpecialZone(seatId, zoneType);
                    });
                    
                    this.updateStatus('📁 자리배치도가 불러와졌습니다!');
                } catch (error) {
                    alert('파일을 읽는 중 오류가 발생했습니다.');
                    console.error('Layout loading error:', error);
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }

    initializeD3() {
        const chartContainer = this.elements.orgChart;
        const width = chartContainer.clientWidth;
        const height = 700; // 컨테이너 고정 높이

        this.svg = d3.select(chartContainer)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // 줌 기능 설정 (더 넓은 확대/축소 범위)
        this.zoom = d3.zoom()
            .scaleExtent([0.05, 5])
            .on('zoom', (event) => {
                this.currentTransform = event.transform;
                this.svg.select('g').attr('transform', event.transform);
            });

        this.svg.call(this.zoom);

        // 메인 그룹 생성
        this.svg.append('g').attr('class', 'main-group');

        // 트리 레이아웃 설정 - 일정한 격자 간격 사용
        this.treeLayout = d3.tree()
            .nodeSize([200, 180]) // 더 넓은 일정한 노드 간격 (width, height)
            .separation((a, b) => {
                // 완전히 일정한 간격 사용
                return 1.2; // 모든 노드 간격을 1.2로 통일
            });
    }



    handleExcelUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.updateStatus('엑셀 파일을 처리하고 있습니다...');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                this.parseExcelData(jsonData);
                this.updateStatus('엑셀 파일이 성공적으로 업로드되었습니다!');
            } catch (error) {
                this.updateStatus('엑셀 파일 처리 중 오류가 발생했습니다.');
                console.error('Excel parsing error:', error);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    parseExcelData(jsonData) {
        this.people = [];
        this.teamColors.clear();
        this.usedColors.clear();
        
        const tempPeople = [];
        
        jsonData.forEach(row => {
            // 다양한 컬럼명 패턴 지원
            const name = row['이름'] || row['Name'] || row['성명'] || row['name'] || '';
            const position = row['직급'] || row['Position'] || row['직급'] || row['position'] || '';
            const task = row['임무'] || row['Task'] || row['업무'] || row['task'] || '';
            const department = row['부서'] || row['Department'] || row['팀'] || row['department'] || '';
            const manager = row['상위자'] || row['Manager'] || row['상사'] || row['manager'] || '';

            if (name.trim()) {
                tempPeople.push({
                    id: this.generateId(),
                    name: name.trim(),
                    position: position.trim(),
                    task: task.trim() || '일반업무',
                    department: department.trim(),
                    manager: manager.trim()
                });
            }
        });

        // 대표이사 자동 처리
        const ceoPositions = ['대표이사', '대표', '사장', '회장', 'CEO', 'ceo'];
        const ceoPersons = tempPeople.filter(person => 
            ceoPositions.some(pos => 
                person.position.toLowerCase().includes(pos.toLowerCase()) || 
                person.name === '강필구'
            )
        );

        // 대표이사가 있는 경우 처리
        if (ceoPersons.length > 0) {
            const ceo = ceoPersons[0]; // 첫 번째 대표이사만 사용
            ceo.manager = '';
            ceo.department = ceo.department || '경영진';
            
            // 다른 최상위 인물들을 CEO 하위로 이동
            tempPeople.forEach(person => {
                if (person.name !== ceo.name && !person.manager) {
                    person.manager = ceo.name;
                }
            });
        }

        this.people = tempPeople;
        
        // CEO 보호 로직 적용
        this.ensureCEOExists();
        this.enforceCEODefaults();
        
        this.updatePeopleList();
        this.updateChart();
        
        // 엑셀 데이터를 거시적 관점으로 보기
        setTimeout(() => {
            this.fitToView();
        }, 200);
        
        // 자동 저장
        this.autoSaveToLocalStorage();
    }

    loadSampleData() {
        // 기존 데이터가 있는 경우 확인 팝업 표시
        if (this.people.length > 0) {
            this.showConfirmModal();
            return;
        }
        
        // 기존 데이터가 없는 경우 바로 로드
        this.loadSampleDataInternal();
    }

    showConfirmModal() {
        this.elements.confirmModal.classList.add('active');
        this.updateStatus('샘플 데이터 로드 확인이 필요합니다.');
    }

    hideConfirmModal() {
        this.elements.confirmModal.classList.remove('active');
        this.updateStatus('샘플 데이터 로드가 취소되었습니다.');
    }

    async confirmLoadSampleData() {
        this.hideConfirmModal();
        
        // 현재 데이터를 로컬 스토리지에 백업
        this.saveToLocalStorage();
        
        // 엑셀 파일로 자동 다운로드
            this.updateStatus('기존 데이터를 엑셀로 백업하는 중...');
            this.exportToExcel();
            
            // 잠시 대기 후 샘플 데이터 로드
            setTimeout(() => {
                this.loadSampleDataInternal();
                this.updateStatus('기존 데이터가 백업되었습니다! 새로운 샘플 데이터가 로드되었습니다.');
            }, 1000);
    }

    saveToLocalStorage() {
        try {
            const backupData = {
                people: this.people,
                timestamp: new Date().toISOString(),
                backupType: 'sample_load_backup'
            };
            localStorage.setItem('orgchart_backup', JSON.stringify(backupData));
            console.log('데이터가 로컬 스토리지에 백업되었습니다.');
        } catch (error) {
            console.error('로컬 스토리지 백업 실패:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const backupData = localStorage.getItem('orgchart_backup');
            if (backupData) {
                const parsed = JSON.parse(backupData);
                return parsed.people || [];
            }
        } catch (error) {
            console.error('로컬 스토리지 불러오기 실패:', error);
        }
        return [];
    }

    autoSaveToLocalStorage() {
        try {
            const autoSaveData = {
                people: this.people,
                timestamp: new Date().toISOString(),
                backupType: 'auto_save'
            };
            localStorage.setItem('orgchart_autosave', JSON.stringify(autoSaveData));
        } catch (error) {
            console.error('자동 저장 실패:', error);
        }
    }

    handleRowButtonClick(e) {
        if (e.target.classList.contains('add-row-btn')) {
            this.addInputRow();
        } else if (e.target.classList.contains('remove-row-btn')) {
            this.removeInputRow(e.target.closest('.input-row'));
        }
    }

    handleRowKeyPress(e) {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
            e.preventDefault();
            this.addAllPeople();
        }
    }

    addInputRow() {
        const newRow = document.createElement('div');
        newRow.className = 'input-row';
        newRow.dataset.row = this.rowCounter++;
        
        const hasMultipleRows = this.elements.inputRows.children.length > 0;
        
        newRow.innerHTML = `
            <input type="text" placeholder="이름" class="name-input">
            <input type="text" placeholder="직급" class="position-input">
            <input type="text" placeholder="임무" class="task-input">
            <input type="text" placeholder="부서" class="department-input">
            <input type="text" placeholder="상위자 (선택사항)" class="manager-input">
            <button type="button" class="add-row-btn">➕</button>
            ${hasMultipleRows ? '<button type="button" class="remove-row-btn">➖</button>' : ''}
        `;
        
        this.elements.inputRows.appendChild(newRow);
        
        // 기존 모든 행에 제거 버튼 추가 (1개 이상의 행이 있을 때)
        if (this.elements.inputRows.children.length > 1) {
            Array.from(this.elements.inputRows.children).forEach(row => {
                if (!row.querySelector('.remove-row-btn')) {
                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'remove-row-btn';
                    removeBtn.textContent = '➖';
                    row.appendChild(removeBtn);
                }
            });
        }
        
        // 새 행의 첫 번째 입력에 포커스
        newRow.querySelector('.name-input').focus();
        
        this.updateStatus(`새 입력 행이 추가되었습니다. (총 ${this.elements.inputRows.children.length}개)`);
    }

    removeInputRow(row) {
        if (this.elements.inputRows.children.length <= 1) {
            alert('최소 하나의 입력 행은 필요합니다.');
            return;
        }
        
        row.remove();
        
        // 행이 1개만 남으면 제거 버튼 삭제
        if (this.elements.inputRows.children.length === 1) {
            const lastRow = this.elements.inputRows.children[0];
            const removeBtn = lastRow.querySelector('.remove-row-btn');
            if (removeBtn) {
                removeBtn.remove();
            }
        }
        
        this.updateStatus(`입력 행이 제거되었습니다. (총 ${this.elements.inputRows.children.length}개)`);
    }

    addAllPeople() {
        const rows = Array.from(this.elements.inputRows.children);
        const peopleToAdd = [];
        let errorCount = 0;
        let successCount = 0;
        
        rows.forEach((row, index) => {
            const name = row.querySelector('.name-input').value.trim();
            const position = row.querySelector('.position-input').value.trim();
            const task = row.querySelector('.task-input').value.trim();
            const department = row.querySelector('.department-input').value.trim();
            const manager = row.querySelector('.manager-input').value.trim();
            
            if (!name) {
                row.querySelector('.name-input').style.borderColor = '#e53e3e';
                errorCount++;
                return;
            } else {
                row.querySelector('.name-input').style.borderColor = '#e2e8f0';
            }
            
            // 중복 이름 확인
            if (this.people.some(person => person.name === name)) {
                row.querySelector('.name-input').style.borderColor = '#e53e3e';
                errorCount++;
                return;
            }
            
            // CEO 중복 확인
            if (name === this.ceoInfo.name) {
                row.querySelector('.name-input').style.borderColor = '#e53e3e';
                errorCount++;
                return;
            }
            
            // CEO 직급 확인
            const ceoPositions = ['대표이사', '대표', '사장', '회장', 'CEO', 'ceo'];
            const isCEO = ceoPositions.some(pos => 
                position.toLowerCase().includes(pos.toLowerCase())
            );
            
            if (isCEO) {
                row.querySelector('.position-input').style.borderColor = '#e53e3e';
                errorCount++;
                return;
            } else {
                row.querySelector('.position-input').style.borderColor = '#e2e8f0';
            }
            
            // 상위자 존재 확인
            if (manager && !this.people.some(person => person.name === manager) && 
                !peopleToAdd.some(person => person.name === manager)) {
                row.querySelector('.manager-input').style.borderColor = '#e53e3e';
                errorCount++;
                return;
            } else {
                row.querySelector('.manager-input').style.borderColor = '#e2e8f0';
            }
            
            peopleToAdd.push({
                id: this.generateId(),
                name,
                position,
                task: task || '일반업무',
                department: department || '일반',
                manager
            });
            
            successCount++;
        });
        
        if (errorCount > 0) {
            this.updateStatus(`${errorCount}개의 오류가 있습니다. 빨간색 테두리 필드를 확인해주세요.`);
            return;
        }
        
        if (peopleToAdd.length === 0) {
            this.updateStatus('추가할 데이터가 없습니다.');
            return;
        }
        
        // 모든 사람 추가
        this.people.push(...peopleToAdd);
        
        // CEO 보호 로직 적용
        this.ensureCEOExists();
        this.enforceCEODefaults();
        
        this.updatePeopleList();
        this.updateChart();
        this.autoSaveToLocalStorage();
        
        // 입력 필드 초기화
        this.clearInputs();
        
        this.updateStatus(`${successCount}명이 성공적으로 추가되었습니다!`);
    }

    clearInputs() {
        // 모든 입력 행 제거하고 하나만 남기기
        this.elements.inputRows.innerHTML = `
            <div class="input-row" data-row="0">
                <input type="text" placeholder="이름" class="name-input">
                <input type="text" placeholder="직급" class="position-input">
                <input type="text" placeholder="임무" class="task-input">
                <input type="text" placeholder="부서" class="department-input">
                <input type="text" placeholder="상위자 (선택사항)" class="manager-input">
                <button type="button" class="add-row-btn">➕</button>
            </div>
        `;
        
        this.rowCounter = 1;
        this.updateStatus('모든 입력이 초기화되었습니다.');
    }

    loadFromAutoSave() {
        try {
            const autoSaveData = localStorage.getItem('orgchart_autosave');
            if (autoSaveData) {
                const parsed = JSON.parse(autoSaveData);
                return parsed.people || [];
            }
        } catch (error) {
            console.error('자동 저장 불러오기 실패:', error);
        }
        return [];
    }

    loadSampleDataInternal() {
        this.teamColors.clear();
        this.usedColors.clear();
        
        this.people = [
            // 최고 경영진 - 강필구 대표이사님
            { id: '1', ...this.ceoInfo },
            
            // 각 부서의 최고 책임자 (CEO 직속)
            { id: '2', name: '박병도', position: '실장', task: '전략기획 총괄', department: '전략기획실', manager: '강필구' },
            { id: '3', name: '김정준', position: '본부장', task: '영업 전체 총괄', department: '브랜드사업부', manager: '강필구' },
            { id: '4', name: '신선일', position: '이사', task: '회계 총괄', department: '경영관리실', manager: '강필구' },
            { id: '5', name: '신선희', position: '이사', task: '물류(남양주) 총괄', department: '물류지원부', manager: '강필구' },
            { id: '6', name: '강희구', position: '이사', task: '물류(용인) 총괄', department: '물류지원부', manager: '강필구' },
            
            // 전략기획실
            { id: '7', name: '강병현', position: '팀장', task: '전략기획, 영업 부총괄', department: '전략기획실', manager: '박병도' },
            { id: '8', name: '지윤환', position: '과장', task: '전략기획, 시스템', department: '전략기획실', manager: '강병현' },
            
            // 경영관리실
            { id: '9', name: '유은주', position: '과장', task: '회계 부총괄', department: '경영관리실', manager: '신선일' },
            { id: '10', name: '정아린', position: '사원', task: '회계(아이베)', department: '경영관리실', manager: '유은주' },
            { id: '11', name: '장주희', position: '사원', task: '회계(크로네)', department: '경영관리실', manager: '유은주' },
            { id: '12', name: '박아휘', position: '사원', task: '회계(아이베)', department: '경영관리실', manager: '유은주' },
            { id: '13', name: '최혁준', position: '사원', task: '총무,회계(몹스)', department: '경영관리실', manager: '유은주' },
            
            // 고객지원부
            { id: '14', name: '신선주', position: '팀장', task: '고객응대 총괄', department: '고객지원부', manager: '강필구' },
            { id: '15', name: '최이슬', position: '과장', task: '고객응대(직구)', department: '고객지원부', manager: '신선주' },
            { id: '16', name: '박주영', position: '사원', task: '고객응대', department: '고객지원부', manager: '최이슬' },
            { id: '17', name: '노가을', position: '수습', task: '고객응대', department: '고객지원부', manager: '최이슬' },
            { id: '18', name: '장주현', position: '수습', task: '고객응대', department: '고객지원부', manager: '최이슬' },
            { id: '19', name: '최윤민', position: '수습', task: '고객응대', department: '고객지원부', manager: '최이슬' },
            
            // 물류지원부 (남양주)
            { id: '20', name: '고성철', position: '과장', task: '물류(남양주)', department: '물류지원부', manager: '신선희' },
            { id: '21', name: '손선남', position: '과장', task: '물류(남양주)', department: '물류지원부', manager: '신선희' },
            { id: '22', name: '백인호', position: '대리', task: '물류(남양주)', department: '물류지원부', manager: '고성철' },
            { id: '23', name: '김종희', position: '사원', task: '물류(남양주)', department: '물류지원부', manager: '백인호' },
            
            // 브랜드사업부 - 드리미팀
            { id: '24', name: '강병훈', position: '팀장', task: '드리미(백화점) 영업총괄', department: '브랜드사업부', manager: '김정준' },
            { id: '25', name: '윤성규', position: '파트장', task: '드리미(전체) 영업총괄', department: '브랜드사업부', manager: '김정준' },
            { id: '26', name: '이영우', position: '과장', task: '드리미(백화점) 영업부총괄', department: '브랜드사업부', manager: '강병훈' },
            { id: '27', name: '설길호', position: '대리', task: '드리미(백화점) 영업', department: '브랜드사업부', manager: '이영우' },
            { id: '28', name: '이윤경', position: '사원', task: '드리미(백화점) 영업', department: '브랜드사업부', manager: '설길호' },
            { id: '29', name: '황재완', position: '대리', task: '드리미(온라인) 영업', department: '브랜드사업부', manager: '윤성규' },
            { id: '30', name: '이수진', position: '주임', task: '드리미(온라인) 영업', department: '브랜드사업부', manager: '황재완' },
            { id: '31', name: '조하정', position: '수습', task: '드리미(온라인) 영업', department: '브랜드사업부', manager: '황재완' },
            { id: '32', name: '박민찬', position: '주임', task: '드리미 SCM', department: '브랜드사업부', manager: '윤성규' },
            
            // 브랜드사업부 - 압타밀팀
            { id: '33', name: '김영훈', position: '파트장', task: '압타밀 영업총괄', department: '브랜드사업부', manager: '김정준' },
            { id: '34', name: '송예진', position: '사원', task: '압타밀(온라인) 영업', department: '브랜드사업부', manager: '김영훈' },
            { id: '35', name: '서정민', position: '사원', task: '압타밀(온라인) 영업', department: '브랜드사업부', manager: '김영훈' },
            { id: '36', name: '이지혜', position: '사원', task: '압타밀 SCM/산후조리원', department: '브랜드사업부', manager: '김영훈' },
            { id: '37', name: '박효진', position: '대리', task: '압타밀 SCM/직구', department: '브랜드사업부', manager: '김영훈' },
            { id: '38', name: '신유정', position: '매니저', task: '압타밀(산후조리원) 영업', department: '브랜드사업부', manager: '김영훈' },
            
            // 브랜드사업부 - 기타
            { id: '39', name: '조성익', position: '수습', task: '레이레이 영업외', department: '브랜드사업부', manager: '김정준' },
            
            // 브랜드사업부(M) - 마케팅
            { id: '40', name: '김민욱', position: '팀장', task: '마케팅 전체 총괄', department: '브랜드사업부(M)', manager: '김정준' },
            { id: '41', name: '지연아', position: '과장', task: '컨텐츠(디자인) 총괄', department: '브랜드사업부(M)', manager: '김민욱' },
            { id: '42', name: '홍성수', position: '과장', task: '드리미 마케팅 부총괄', department: '브랜드사업부(M)', manager: '김민욱' },
            { id: '43', name: '김예진', position: '과장', task: '브라이튼 마케팅', department: '브랜드사업부(M)', manager: '김민욱' },
            
            // 브랜드사업부(M) - 컨텐츠팀
            { id: '44', name: '조예은', position: '대리', task: '컨텐츠(디자인)', department: '브랜드사업부(M)', manager: '지연아' },
            { id: '45', name: '조민지', position: '주임', task: '컨텐츠(디자인)', department: '브랜드사업부(M)', manager: '지연아' },
            { id: '46', name: '박규원', position: '사원', task: '컨텐츠(디자인)', department: '브랜드사업부(M)', manager: '지연아' },
            
            // 브랜드사업부(M) - 드리미 마케팅팀
            { id: '47', name: '김정호', position: '대리', task: '드리미 마케팅', department: '브랜드사업부(M)', manager: '홍성수' },
            { id: '48', name: '정성원', position: '주임', task: '드리미 마케팅', department: '브랜드사업부(M)', manager: '홍성수' },
            { id: '49', name: '권도연', position: '주임', task: '드리미 마케팅', department: '브랜드사업부(M)', manager: '홍성수' },
            { id: '50', name: '이다현', position: '사원', task: '드리미 마케팅', department: '브랜드사업부(M)', manager: '홍성수' },
            { id: '51', name: '변해형', position: '수습', task: '드리미 마케팅', department: '브랜드사업부(M)', manager: '홍성수' },
            
            // 브랜드사업부(M) - 브라이튼 마케팅팀
            { id: '52', name: '박지영', position: '대리', task: '브라이튼 마케팅', department: '브랜드사업부(M)', manager: '김예진' },
            { id: '53', name: '최은영', position: '대리', task: '브라이튼 마케팅', department: '브랜드사업부(M)', manager: '김예진' },
            
            // 브랜드사업부(M) - 압타밀 마케팅팀
            { id: '54', name: '김은정', position: '대리', task: '압타밀 마케팅', department: '브랜드사업부(M)', manager: '김민욱' },
            { id: '55', name: '이산하', position: '사원', task: '압타밀 마케팅', department: '브랜드사업부(M)', manager: '김은정' },
            { id: '56', name: '최아리찬', position: '사원', task: '압타밀 마케팅', department: '브랜드사업부(M)', manager: '김은정' },
            { id: '57', name: '권재은', position: '사원', task: '압타밀 마케팅', department: '브랜드사업부(M)', manager: '김은정' },
            { id: '58', name: '형성인', position: '사원', task: '압타밀 마케팅', department: '브랜드사업부(M)', manager: '김은정' },
            { id: '59', name: '박종호', position: '수습', task: '압타밀 마케팅', department: '브랜드사업부(M)', manager: '김은정' },
            { id: '60', name: '박시연', position: '수습', task: '압타밀 마케팅', department: '브랜드사업부(M)', manager: '김은정' },
            { id: '61', name: '신선경(재택)', position: '사원', task: '압타밀 마케팅(재택)', department: '브랜드사업부(M)', manager: '김은정' },
            

        ];

        // CEO 보호 로직 적용
        this.ensureCEOExists();
        this.enforceCEODefaults();
        
        this.updatePeopleList();
        this.updateChart();
        
        // 샘플 데이터를 거시적 관점으로 보기
        setTimeout(() => {
            this.fitToView();
        }, 200);
        
        this.updateStatus(`샘플 데이터가 로드되었습니다! (총 ${this.people.length}명)`);
    }

    deletePerson(id) {
        const person = this.people.find(p => p.id === id);
        if (!person) return;

        // CEO는 삭제 불가
        if (this.isCEO(person)) {
            alert('대표이사님은 삭제할 수 없습니다.');
            return;
        }

        // 하위 직원이 있는지 확인
        const hasSubordinates = this.people.some(p => p.manager === person.name);
        if (hasSubordinates) {
            if (!confirm(`${person.name}님에게 하위 직원이 있습니다. 정말 삭제하시겠습니까?`)) {
                return;
            }
            // 하위 직원들의 상위자 정보 제거
            this.people.forEach(p => {
                if (p.manager === person.name) {
                    p.manager = '';
                }
            });
        }

        this.people = this.people.filter(p => p.id !== id);
        this.updatePeopleList();
        this.updateChart();
        
        // 자동 저장
        this.autoSaveToLocalStorage();
        
        this.updateStatus(`${person.name}님이 삭제되었습니다.`);
    }

    isCEO(person) {
        return person.name === this.ceoInfo.name;
    }

    ensureCEOExists() {
        // 강필구 대표이사님이 없으면 자동으로 추가
        if (!this.people.some(p => this.isCEO(p))) {
            this.people.unshift({
                id: this.generateId(),
                ...this.ceoInfo
            });
        }
    }

    enforceCEODefaults() {
        // 강필구 대표이사님의 정보를 기본값으로 강제 설정
        const ceo = this.people.find(p => this.isCEO(p));
        if (ceo) {
            ceo.name = this.ceoInfo.name;
            ceo.position = this.ceoInfo.position;
            ceo.task = this.ceoInfo.task;
            ceo.department = this.ceoInfo.department;
            ceo.manager = this.ceoInfo.manager;
        }
    }

    editPerson(id) {
        const person = this.people.find(p => p.id === id);
        if (!person) return;
        
        // CEO는 수정 불가
        if (this.isCEO(person)) {
            alert('대표이사님의 정보는 수정할 수 없습니다.');
            return;
        }

        const personItem = document.querySelector(`[data-id="${id}"]`);
        if (!personItem) return;

        const displayDiv = personItem.querySelector('.person-display');
        const editDiv = personItem.querySelector('.person-edit');
        
        displayDiv.style.display = 'none';
        editDiv.style.display = 'block';
    }

    savePerson(id) {
        const person = this.people.find(p => p.id === id);
        if (!person) return;

        const personItem = document.querySelector(`[data-id="${id}"]`);
        const editDiv = personItem.querySelector('.person-edit');
        
        const newName = editDiv.querySelector('.edit-name').value.trim();
        const newPosition = editDiv.querySelector('.edit-position').value.trim();
        const newTask = editDiv.querySelector('.edit-task').value.trim();
        const newDepartment = editDiv.querySelector('.edit-department').value.trim();
        const newManager = editDiv.querySelector('.edit-manager').value.trim();

        if (!newName) {
            alert('이름을 입력해주세요.');
            return;
        }

        // 이름 중복 확인 (현재 수정 중인 사람 제외)
        if (newName !== person.name && this.people.some(p => p.name === newName)) {
            alert('이미 존재하는 이름입니다.');
            return;
        }

        // 상위자 존재 확인
        if (newManager && !this.people.some(p => p.name === newManager)) {
            alert('상위자가 존재하지 않습니다.');
            return;
        }

        // 자기 자신을 상위자로 설정하는 것을 방지
        if (newManager === newName) {
            alert('자기 자신을 상위자로 설정할 수 없습니다.');
            return;
        }

        // 순환 참조 방지
        if (this.wouldCreateCircularReference(newName, newManager)) {
            alert('이 상위자 설정은 순환 참조를 발생시킵니다.');
            return;
        }

        // 기존 이름이 변경된 경우 하위 직원들의 상위자 정보 업데이트
        if (person.name !== newName) {
            this.people.forEach(p => {
                if (p.manager === person.name) {
                    p.manager = newName;
                }
            });
        }

        // 정보 업데이트
        person.name = newName;
        person.position = newPosition;
        person.task = newTask || '일반업무';
        person.department = newDepartment;
        person.manager = newManager;

        this.updatePeopleList();
        this.updateChart();
        this.updateStatus(`${newName}님의 정보가 수정되었습니다.`);
    }

    cancelEdit(id) {
        const personItem = document.querySelector(`[data-id="${id}"]`);
        if (!personItem) return;

        const displayDiv = personItem.querySelector('.person-display');
        const editDiv = personItem.querySelector('.person-edit');
        
        displayDiv.style.display = 'block';
        editDiv.style.display = 'none';
    }

    wouldCreateCircularReference(name, manager) {
        if (!manager) return false;
        
        let currentManager = manager;
        const visited = new Set();
        
        while (currentManager) {
            if (visited.has(currentManager)) return true;
            if (currentManager === name) return true;
            
            visited.add(currentManager);
            const managerPerson = this.people.find(p => p.name === currentManager);
            currentManager = managerPerson ? managerPerson.manager : null;
        }
        
        return false;
    }

    clearAll() {
        if (!confirm('모든 데이터를 삭제하시겠습니까? (강필구 대표이사님은 보호됩니다)')) return;

        // 강필구 대표이사님만 남기고 모든 데이터 삭제
        this.people = this.people.filter(person => this.isCEO(person));
        this.teamColors.clear();
        this.usedColors.clear();
        
        // CEO 보호 로직 적용
        this.ensureCEOExists();
        this.enforceCEODefaults();
        
        this.updatePeopleList();
        this.updateChart();
        
        // 자동 저장
        this.autoSaveToLocalStorage();
        
        this.updateStatus('모든 데이터가 삭제되었습니다. (대표이사님은 보호됨)');
    }

    exportToExcel() {
        if (this.people.length === 0) {
            alert('내보낼 데이터가 없습니다.');
            return;
        }

        this.updateStatus('엑셀 파일을 생성하고 있습니다...');

        // 엑셀 데이터 준비
        const excelData = this.people.map(person => ({
            '이름': person.name,
            '직급': person.position,
            '임무': person.task,
            '부서': person.department,
            '상위자': person.manager,
            '하위자 수': this.people.filter(p => p.manager === person.name).length,
            '등록일': new Date().toLocaleDateString()
        }));

        // 워크북 생성
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '조직도');

        // 컬럼 너비 조정
        const wscols = [
            { width: 15 }, // 이름
            { width: 20 }, // 직급
            { width: 15 }, // 임무
            { width: 15 }, // 부서
            { width: 15 }, // 상위자
            { width: 10 }, // 하위자 수
            { width: 15 }  // 등록일
        ];
        ws['!cols'] = wscols;

        // 파일 저장
        const fileName = `조직도_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);

        this.updateStatus('엑셀 파일이 다운로드되었습니다!');
    }

    async exportToPDF(isHighQuality = false) {
        if (this.people.length === 0) {
            alert('내보낼 조직도가 없습니다.');
            return;
        }

        this.updateStatus('대형 인쇄용 조직도 PDF 파일을 생성하고 있습니다...');

        try {
            // 현재 줌 상태 저장
            const currentTransform = this.currentTransform;
            
            // 전체 조직도가 보이도록 리셋
            this.centerChart();
            
            // 잠시 대기 (애니메이션 완료)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 대형 인쇄용 설정
            const qualitySettings = {
                scale: 4, // 4배 확대로 조정 (8배는 너무 큼)
                dpi: 300, // DPI 조정
                format: 'a2' // A2 크기로 대형 출력 지원
            };

            // 조직도 캔버스로 변환 (경계선 제거를 위한 설정)
            const chartElement = this.elements.orgChart;
            
            // PDF 생성용 임시 스타일 적용
            const originalStyle = chartElement.style.cssText;
            chartElement.style.border = 'none';
            chartElement.style.outline = 'none';
            chartElement.style.boxShadow = 'none';
            
            const canvas = await html2canvas(chartElement, {
                backgroundColor: '#ffffff',
                scale: qualitySettings.scale,
                useCORS: true,
                allowTaint: true,
                scrollX: 0,
                scrollY: 0,
                width: chartElement.offsetWidth,
                height: chartElement.offsetHeight,
                dpi: qualitySettings.dpi,
                pixelRatio: 1,
                logging: false, // 로그 비활성화
                removeContainer: true // 컨테이너 제거
            });

            // 원래 스타일 복원
            chartElement.style.cssText = originalStyle;

            // PDF 생성
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: qualitySettings.format
            });

            // 이미지 추가 (단일 페이지로 최적화)
            const imgData = canvas.toDataURL('image/png', 1.0);
            const pageWidth = 594; // A2 가로: 594mm
            const pageHeight = 420; // A2 세로: 420mm
            
            // 이미지 크기 계산 (비율 유지)
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            // 이미지가 페이지에 맞는지 확인
            if (imgHeight <= pageHeight) {
                // 단일 페이지로 출력
                const yOffset = (pageHeight - imgHeight) / 2; // 중앙 정렬
                pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight);
            } else {
                // 여러 페이지로 분할 (필요한 경우만)
                let heightLeft = imgHeight;
                let position = 0;

                // 첫 페이지
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;

                // 추가 페이지 (실제로 필요한 경우만)
                while (heightLeft > 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                }
            }

            // 파일 저장
            const fileName = `orgchart_large_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);

            // 원래 줌 상태 복원
            this.svg.call(this.zoom.transform, currentTransform);

            this.updateStatus('대형 인쇄용 조직도 PDF 파일이 다운로드되었습니다!');

        } catch (error) {
            console.error('PDF 생성 오류:', error);
            this.updateStatus('대형 인쇄용 조직도 PDF 생성 중 오류가 발생했습니다.');
        }
    }

    async exportSeatLayoutToPDF() {
        if (this.seatGrid.length === 0) {
            alert('내보낼 자리배치도가 없습니다.');
            return;
        }

        this.updateStatus('대형 인쇄용 자리배치도 PDF 파일을 생성하고 있습니다...');

        try {
            // 현재 줌 상태 저장
            const currentZoom = this.seatZoom;
            const currentPanX = this.seatPanX;
            const currentPanY = this.seatPanY;
            
            // 전체 자리배치도가 보이도록 리셋
            this.resetSeatZoom();
            this.centerSeatView();
            
            // 잠시 대기 (애니메이션 완료)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 대형 인쇄용 설정
            const qualitySettings = {
                scale: 4, // 4배 확대로 조정 (8배는 너무 큼)
                dpi: 300, // DPI 조정
                format: 'a2' // A2 크기로 대형 출력 지원
            };

            // 자리배치도 캔버스로 변환 (경계선 제거를 위한 설정)
            const seatElement = this.elements.seatGrid;
            
            // PDF 생성용 임시 스타일 적용
            const originalStyle = seatElement.style.cssText;
            seatElement.style.border = 'none';
            seatElement.style.outline = 'none';
            seatElement.style.boxShadow = 'none';
            
            const canvas = await html2canvas(seatElement, {
                backgroundColor: '#ffffff',
                scale: qualitySettings.scale,
                useCORS: true,
                allowTaint: true,
                scrollX: 0,
                scrollY: 0,
                width: seatElement.offsetWidth,
                height: seatElement.offsetHeight,
                dpi: qualitySettings.dpi,
                pixelRatio: 1,
                logging: false, // 로그 비활성화
                removeContainer: true // 컨테이너 제거
            });

            // 원래 스타일 복원
            seatElement.style.cssText = originalStyle;

            // PDF 생성
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: qualitySettings.format
            });

            // 이미지 추가 (단일 페이지로 최적화)
            const imgData = canvas.toDataURL('image/png', 1.0);
            const pageWidth = 594; // A2 가로: 594mm
            const pageHeight = 420; // A2 세로: 420mm
            
            // 이미지 크기 계산 (비율 유지)
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            // 이미지가 페이지에 맞는지 확인
            if (imgHeight <= pageHeight) {
                // 단일 페이지로 출력
                const yOffset = (pageHeight - imgHeight) / 2; // 중앙 정렬
                pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight);
            } else {
                // 여러 페이지로 분할 (필요한 경우만)
                let heightLeft = imgHeight;
                let position = 0;

                // 첫 페이지
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;

                // 추가 페이지 (실제로 필요한 경우만)
                while (heightLeft > 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                }
            }

            // 파일 저장
            const fileName = `seatlayout_large_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);

            // 원래 줌 상태 복원
            this.seatZoom = currentZoom;
            this.seatPanX = currentPanX;
            this.seatPanY = currentPanY;
            this.applySeatTransform();

            this.updateStatus('대형 인쇄용 자리배치도 PDF 파일이 다운로드되었습니다!');

        } catch (error) {
            console.error('자리배치도 PDF 생성 오류:', error);
            this.updateStatus('자리배치도 PDF 생성 중 오류가 발생했습니다.');
        }
    }

    updatePeopleList() {
        // CEO 보호 로직 적용
        this.ensureCEOExists();
        this.enforceCEODefaults();
        
        const listContainer = this.elements.peopleList;
        listContainer.innerHTML = '';

        // CEO를 맨 위로 정렬
        const sortedPeople = [...this.people].sort((a, b) => {
            if (this.isCEO(a)) return -1;
            if (this.isCEO(b)) return 1;
            return 0;
        });

        sortedPeople.forEach(person => {
            const personDiv = document.createElement('div');
            const isCEO = this.isCEO(person);
            personDiv.className = isCEO ? 'person-item ceo-item' : 'person-item';
            personDiv.setAttribute('data-id', person.id);
            
            // CEO는 수정/삭제 버튼을 다르게 표시
            const actionButtons = isCEO ? 
                `<div class="action-buttons">
                    <button class="protected-btn" disabled>🔒 보호됨</button>
                </div>` :
                `<div class="action-buttons">
                    <button class="edit-btn" onclick="orgChart.editPerson('${person.id}')">수정</button>
                    <button class="delete-btn" onclick="orgChart.deletePerson('${person.id}')">삭제</button>
                </div>`;
            
            personDiv.innerHTML = `
                <div class="person-display" data-id="${person.id}">
                    <div class="name">${person.name}${isCEO ? ' 👑' : ''}</div>
                    <div class="position">${person.position}</div>
                    <div class="task">${person.task}</div>
                    <div class="department">${person.department}</div>
                    ${person.manager ? `<div class="manager">상위자: ${person.manager}</div>` : ''}
                    ${actionButtons}
                </div>
                <div class="person-edit" data-id="${person.id}" style="display: none;">
                    <input type="text" class="edit-name" value="${person.name}" placeholder="이름">
                    <input type="text" class="edit-position" value="${person.position}" placeholder="직급">
                    <input type="text" class="edit-task" value="${person.task}" placeholder="임무">
                    <input type="text" class="edit-department" value="${person.department}" placeholder="부서">
                    <input type="text" class="edit-manager" value="${person.manager}" placeholder="상위자">
                    <div class="action-buttons">
                        <button class="save-btn" onclick="orgChart.savePerson('${person.id}')">저장</button>
                        <button class="cancel-btn" onclick="orgChart.cancelEdit('${person.id}')">취소</button>
                    </div>
                </div>
            `;
            listContainer.appendChild(personDiv);
        });

        this.updatePersonCount();
    }

    updateChart() {
        // CEO 보호 로직 적용
        this.ensureCEOExists();
        this.enforceCEODefaults();
        
        const svg = this.svg.select('.main-group');
        svg.selectAll('*').remove();

        if (this.people.length === 0) return;

        // 계층 구조 생성
        const hierarchy = this.createHierarchy();
        const root = d3.hierarchy(hierarchy);
        
        // 트리 레이아웃 적용
        this.treeLayout(root);

        // 링크 그리기 - 조직도 스타일 연결선
        this.drawOrganizationLinks(svg, root);

        // 노드 그리기
        const nodes = svg.selectAll('.node')
            .data(root.descendants())
            .enter().append('g')
            .attr('class', d => `node ${d.data.type || 'person'}`)
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .on('click', (event, d) => {
                if (d.data.name && d.data.type === 'person') {
                    this.highlightPerson(d.data.name);
                }
            });

        // 팀 노드 (사각형) - 대형 인쇄용으로 크기 증가
        nodes.filter(d => d.data.type === 'team')
            .append('rect')
            .attr('x', -80)
            .attr('y', -35)
            .attr('width', 160)
            .attr('height', 70)
            .attr('rx', 20)
            .style('fill', d => d.data.teamColor || this.getTeamColor(d.data.department))
            .style('stroke', d => {
                const teamColor = d.data.teamColor || this.getTeamColor(d.data.department);
                return this.getTeamStrokeColorFromBase(teamColor);
            })
            .style('stroke-width', 4);

        // 개인 노드 (원형) - 대형 인쇄용으로 크기 증가
        nodes.filter(d => d.data.type === 'person')
            .append('circle')
            .attr('r', d => this.isCEO(d.data) ? 75 : 55)
            .style('fill', d => this.getPersonColor(d.data))
            .style('stroke', d => this.getPersonStrokeColor(d.data))
            .style('stroke-width', d => this.isCEO(d.data) ? 4 : 3);

        // 팀명 텍스트 - 대형 인쇄용으로 크기 증가
        nodes.filter(d => d.data.type === 'team')
            .append('text')
            .attr('dy', '0.3em')
            .style('text-anchor', 'middle')
            .style('dominant-baseline', 'middle')
            .style('font-size', '22px')
            .style('fill', d => {
                const backgroundColor = d.data.teamColor || this.getTeamColor(d.data.department);
                return this.getTextColor(backgroundColor);
            })
            .style('font-weight', 'bold')
            .style('text-shadow', d => {
                const backgroundColor = d.data.teamColor || this.getTeamColor(d.data.department);
                const textColor = this.getTextColor(backgroundColor);
                // 텍스트가 검은색이면 밝은 그림자, 흰색이면 어두운 그림자
                return textColor === '#000000' ? 
                    '2px 2px 4px rgba(255,255,255,0.8)' : 
                    '2px 2px 4px rgba(0,0,0,0.8)';
            })
            .text(d => d.data.name);

        // CEO 왕관 텍스트 (맨 위) - 대형 인쇄용으로 크기 증가
        nodes.filter(d => d.data.type === 'person' && this.isCEO(d.data))
            .append('text')
            .attr('dy', '-2.2em')
            .style('text-anchor', 'middle')
            .style('font-size', '28px')
            .style('fill', '#ffd700')
            .style('text-shadow', '3px 3px 6px rgba(0,0,0,0.5)')
            .text('👑');

        // 개인 이름 텍스트 - 대형 인쇄용으로 크기 증가
        nodes.filter(d => d.data.type === 'person')
            .append('text')
            .attr('dy', d => this.isCEO(d.data) ? '-1.0em' : '-1.8em')
            .style('text-anchor', 'middle')
            .style('dominant-baseline', 'middle')
            .style('font-size', d => this.isCEO(d.data) ? '22px' : '18px')
            .style('fill', 'white')
            .style('font-weight', 'bold')
            .style('text-shadow', '2px 2px 4px rgba(0,0,0,0.8)')
            .text(d => d.data.name);

        // 개인 직급 텍스트 - 대형 인쇄용으로 크기 증가
        nodes.filter(d => d.data.type === 'person')
            .append('text')
            .attr('dy', d => this.isCEO(d.data) ? '1.5em' : '-0.3em')
            .style('text-anchor', 'middle')
            .style('dominant-baseline', 'middle')
            .style('font-size', d => this.isCEO(d.data) ? '18px' : '14px')
            .style('fill', '#e2e8f0')
            .style('text-shadow', '2px 2px 4px rgba(0,0,0,0.8)')
            .text(d => d.data.position);

        // 개인 임무 텍스트 - 대형 인쇄용으로 크기 증가
        nodes.filter(d => d.data.type === 'person' && !this.isCEO(d.data))
            .append('text')
            .attr('dy', '2.2em')
            .style('text-anchor', 'middle')
            .style('dominant-baseline', 'middle')
            .style('font-size', '12px')
            .style('fill', '#90cdf4')
            .style('text-shadow', '2px 2px 4px rgba(0,0,0,0.8)')
            .text(d => d.data.task || '일반업무');

        // 차트 중앙 정렬 (초기 로드가 아닌 경우에만)
        // setTimeout을 사용해 DOM 업데이트 후 실행
        setTimeout(() => {
            this.centerChart();
        }, 100);
    }

    createHierarchy() {
        // 최상위 노드 찾기 (상위자가 없는 사람들)
        const topLevel = this.people.filter(person => !person.manager);
        
        if (topLevel.length === 0) {
            // 상위자가 모두 있는 경우, 첫 번째 사람을 루트로 설정
            return this.people.length > 0 ? this.buildNodeWithTeam(this.people[0], null) : { name: '', children: [] };
        }

        if (topLevel.length === 1) {
            return this.buildNodeWithTeam(topLevel[0], null);
        }

        // 여러 최상위 노드가 있는 경우 가상의 루트 노드 생성
        return {
            name: '',
            position: '',
            department: '',
            type: 'root',
            children: topLevel.map(person => this.buildNodeWithTeam(person, null))
        };
    }

    buildNode(person) {
        const children = this.people
            .filter(p => p.manager === person.name)
            .map(child => this.buildNode(child));

        return {
            name: person.name,
            position: person.position,
            task: person.task,
            department: person.department,
            type: 'person',
            children: children
        };
    }

    buildNodeWithTeam(person, parentTeamColor = null) {
        // 해당 사람의 하위 직원들 찾기
        const directReports = this.people.filter(p => p.manager === person.name);
        
        // 부서별로 그룹화
        const departmentGroups = {};
        directReports.forEach(report => {
            if (!departmentGroups[report.department]) {
                departmentGroups[report.department] = [];
            }
            departmentGroups[report.department].push(report);
        });

        const children = [];

        // 각 부서별로 팀 노드 생성
        Object.keys(departmentGroups).forEach(dept => {
            const deptMembers = departmentGroups[dept];
            
            // 부서가 현재 사람의 부서와 같은 경우 팀 노드 없이 직접 연결
            if (dept === person.department) {
                children.push(...deptMembers.map(member => this.buildNodeWithTeam(member, parentTeamColor)));
            } else {
                // 다른 부서의 경우 팀 노드 생성 (1명이라도 팀 노드 생성)
                const teamColor = this.getTeamColor(dept);
                const teamNode = {
                    name: dept,
                    position: '팀',
                    department: dept,
                    type: 'team',
                    teamColor: teamColor,
                    children: deptMembers.map(member => this.buildNodeWithTeam(member, teamColor))
                };
                children.push(teamNode);
            }
        });

        return {
            name: person.name,
            position: person.position,
            task: person.task,
            department: person.department,
            type: 'person',
            parentTeamColor: parentTeamColor,
            children: children
        };
    }

    getNodeColor(department) {
        const colors = {
            '경영진': '#667eea',
            '개발팀': '#48bb78',
            '마케팅팀': '#ed8936',
            '영업팀': '#38b2ac',
            '인사팀': '#9f7aea',
            '재무팀': '#f56565'
        };
        return colors[department] || '#a0aec0';
    }

    getNodeStrokeColor(department) {
        const colors = {
            '경영진': '#4c51bf',
            '개발팀': '#38a169',
            '마케팅팀': '#c05621',
            '영업팀': '#2c7a7b',
            '인사팀': '#805ad5',
            '재무팀': '#e53e3e'
        };
        return colors[department] || '#718096';
    }

    generateRandomColor() {
        const colors = [
            '#667eea', '#48bb78', '#ed8936', '#38b2ac', '#9f7aea', '#f56565',
            '#4299e1', '#38a169', '#d69e2e', '#00b5d8', '#805ad5', '#e53e3e',
            '#3182ce', '#319795', '#dd6b20', '#0987a0', '#7c3aed', '#dc2626',
            '#2b6cb0', '#2c7a7b', '#c05621', '#0891b2', '#6b46c1', '#b91c1c',
            '#1e40af', '#065f46', '#92400e', '#155e75', '#581c87', '#991b1b',
            '#1d4ed8', '#047857', '#a16207', '#0e7490', '#6d28d9', '#7f1d1d',
            '#2563eb', '#059669', '#ca8a04', '#0891b2', '#7c2d12', '#8b5cf6',
            '#3b82f6', '#10b981', '#06b6d4', '#a855f7', '#ef4444',
            '#60a5fa', '#34d399', '#67e8f9', '#c084fc', '#f87171'
            // 너무 밝은 색상들 제거: '#f59e0b', '#fbbf24', '#fcd34d', '#a5f3fc', '#ddd6fe', '#fca5a5'
        ];
        
        // 아직 사용되지 않은 색상 찾기
        const availableColors = colors.filter(color => !this.usedColors.has(color));
        
        if (availableColors.length === 0) {
            // 모든 색상이 사용되었다면 HSL로 적절한 명도의 랜덤 색상 생성
            const hue = Math.floor(Math.random() * 360);
            const saturation = Math.floor(Math.random() * 40) + 60; // 60-100%
            const lightness = Math.floor(Math.random() * 25) + 35; // 35-60% (더 어두운 범위)
            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        }
        
        // 랜덤하게 선택
        const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];
        this.usedColors.add(randomColor);
        return randomColor;
    }

    getTeamColor(department) {
        // 이미 캐시된 색상이 있다면 사용
        if (this.teamColors.has(department)) {
            return this.teamColors.get(department);
        }
        
        // 기본 색상 먼저 시도
        const defaultColors = {
            '경영진': '#667eea',
            '개발팀': '#48bb78',
            '마케팅팀': '#ed8936',
            '영업팀': '#38b2ac',
            '인사팀': '#9f7aea',
            '재무팀': '#f56565'
        };
        
        let color;
        if (defaultColors[department] && !this.usedColors.has(defaultColors[department])) {
            color = defaultColors[department];
            this.usedColors.add(color);
        } else {
            // 기본 색상이 없거나 이미 사용된 경우 랜덤 색상 생성
            color = this.generateRandomColor();
        }
        
        this.teamColors.set(department, color);
        return color;
    }

    getTeamStrokeColor(department) {
        const baseColor = this.getTeamColor(department);
        return this.getTeamStrokeColorFromBase(baseColor);
    }

    getTeamStrokeColorFromBase(baseColor) {
        // 기본 색상과 매칭되는 stroke 색상이 있다면 사용
        const defaultStrokes = {
            '#667eea': '#4c51bf',
            '#48bb78': '#38a169',
            '#ed8936': '#c05621',
            '#38b2ac': '#2c7a7b',
            '#9f7aea': '#805ad5',
            '#f56565': '#e53e3e'
        };
        
        if (defaultStrokes[baseColor]) {
            return defaultStrokes[baseColor];
        }
        
        // HSL 색상인 경우 더 어둡게 만들기
        if (baseColor.startsWith('hsl')) {
            const hslMatch = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
            if (hslMatch) {
                const [, h, s, l] = hslMatch;
                const darkerL = Math.max(20, parseInt(l) - 20);
                return `hsl(${h}, ${s}%, ${darkerL}%)`;
            }
        }
        
        // 기본적으로 더 어두운 색상 생성
        return this.darkenColor(baseColor);
    }

    darkenColor(color) {
        // 간단한 색상 어둡게 만들기
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - 30);
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - 30);
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - 30);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    lightenColor(color, amount = 40) {
        // HSL 색상인 경우
        if (color.startsWith('hsl')) {
            const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
            if (hslMatch) {
                const [, h, s, l] = hslMatch;
                const lighterL = Math.min(90, parseInt(l) + amount);
                const lighterS = Math.max(30, parseInt(s) - 20); // 채도도 약간 낮춤
                return `hsl(${h}, ${lighterS}%, ${lighterL}%)`;
            }
        }
        
        // HEX 색상인 경우
        const hex = color.replace('#', '');
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + amount);
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + amount);
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + amount);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    getPersonColor(person) {
        // 팀 하위에 있는 개인인 경우 팀 색상의 연한 버전 사용
        if (person.parentTeamColor) {
            return this.lightenColor(person.parentTeamColor);
        }
        
        // 기본 개인 색상 사용
        return this.getNodeColor(person.department);
    }

    getPersonStrokeColor(person) {
        // 팀 하위에 있는 개인인 경우 팀 색상의 약간 어두운 버전 사용
        if (person.parentTeamColor) {
            return this.darkenColor(this.lightenColor(person.parentTeamColor, 20));
        }
        
        // 기본 개인 테두리 색상 사용
        return this.getNodeStrokeColor(person.department);
    }

    // 색상의 명도 계산
    getLuminance(color) {
        let r, g, b;
        
        if (color.startsWith('#')) {
            const hex = color.replace('#', '');
            r = parseInt(hex.substr(0, 2), 16) / 255;
            g = parseInt(hex.substr(2, 2), 16) / 255;
            b = parseInt(hex.substr(4, 2), 16) / 255;
        } else if (color.startsWith('hsl')) {
            const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
            if (hslMatch) {
                const [, h, s, l] = hslMatch;
                // HSL의 L 값이 60% 이상이면 밝은 색상으로 간주
                return parseInt(l) / 100;
            }
        }
        
        // RGB to luminance
        const sRGB = [r, g, b].map(c => {
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        
        return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    }

    // 색상에 따른 텍스트 색상 결정
    getTextColor(backgroundColor) {
        const luminance = this.getLuminance(backgroundColor);
        // 명도가 0.5 이상이면 검은색, 아니면 흰색
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    highlightPerson(name) {
        // 사이드바에서 해당 인물 하이라이트
        const personItems = document.querySelectorAll('.person-item');
        personItems.forEach(item => {
            item.style.backgroundColor = '';
            item.style.transform = '';
        });

        personItems.forEach(item => {
            if (item.querySelector('.name').textContent === name) {
                item.style.backgroundColor = '#e6fffa';
                item.style.transform = 'translateX(10px)';
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    zoomIn() {
        this.svg.transition().duration(300).call(
            this.zoom.scaleBy, 1.3
        );
    }

    zoomOut() {
        this.svg.transition().duration(300).call(
            this.zoom.scaleBy, 0.7
        );
    }

    resetZoom() {
        // 원래 크기가 아닌 전체 보기로 리셋
        this.fitToView();
    }

    centerChart() {
        const svg = this.svg.select('.main-group');
        const bbox = svg.node()?.getBBox();
        
        if (!bbox) return;

        const width = this.svg.attr('width');
        const height = this.svg.attr('height');
        const centerX = width / 2;
        const centerY = height / 2;
        
        // 여백을 충분히 두고 전체 조직도가 보이도록 스케일 계산
        const padding = 80;
        const scaleX = (width - padding * 2) / bbox.width;
        const scaleY = (height - padding * 2) / bbox.height;
        
        // 거시적 관점을 위해 적절한 최대 스케일 제한
        const maxScale = 1.2;
        const minScale = 0.1;
        const scale = Math.max(minScale, Math.min(scaleX, scaleY, maxScale));
        
        const translateX = centerX - (bbox.x + bbox.width / 2) * scale;
        const translateY = centerY - (bbox.y + bbox.height / 2) * scale;

        this.svg.transition().duration(750).call(
            this.zoom.transform,
            d3.zoomIdentity.translate(translateX, translateY).scale(scale)
        );
    }

    fitToView() {
        const svg = this.svg.select('.main-group');
        const bbox = svg.node()?.getBBox();
        
        if (!bbox) return;

        const width = this.svg.attr('width');
        const height = this.svg.attr('height');
        const centerX = width / 2;
        const centerY = height / 2;
        
        // 전체 보기를 위한 더 넉넉한 여백
        const padding = 100;
        const scaleX = (width - padding * 2) / bbox.width;
        const scaleY = (height - padding * 2) / bbox.height;
        
        // 거시적 관점을 위해 더 작은 스케일 사용
        const maxScale = 0.8;
        const minScale = 0.05;
        const scale = Math.max(minScale, Math.min(scaleX, scaleY, maxScale));
        
        const translateX = centerX - (bbox.x + bbox.width / 2) * scale;
        const translateY = centerY - (bbox.y + bbox.height / 2) * scale;

        this.svg.transition().duration(1000).call(
            this.zoom.transform,
            d3.zoomIdentity.translate(translateX, translateY).scale(scale)
        );
        
        this.updateStatus(`전체 조직도를 거시적 관점으로 조정했습니다. (스케일: ${Math.round(scale * 100)}%)`);
    }

    drawOrganizationLinks(svg, root) {
        // 기존 링크 제거
        svg.selectAll('.link').remove();
        
        // 각 노드에 대해 자식들과의 연결선 그리기
        root.descendants().forEach(node => {
            if (node.children && node.children.length > 0) {
                this.drawParentChildLinks(svg, node);
            }
        });
    }

    drawParentChildLinks(svg, parentNode) {
        const children = parentNode.children;
        if (!children || children.length === 0) return;

        const parentX = parentNode.x;
        const parentY = parentNode.y;
        
        // 부모 노드의 연결점 계산 - 일정한 간격에 맞춰 조정
        const parentOffset = parentNode.data.type === 'team' ? 35 : 45; // 팀 노드는 사각형이므로 35, 개인 노드는 원형이므로 45
        
        // 자식 노드들의 위치 정보
        const childPositions = children.map(child => ({
            x: child.x,
            y: child.y,
            offset: child.data.type === 'team' ? 35 : 45 // 각 자식의 타입에 따른 오프셋
        }));

        // 중간 지점 계산 (부모와 자식의 중간)
        const midY = parentY + (childPositions[0].y - parentY) / 2;

        if (children.length === 1) {
            // 자식이 1명인 경우: 직선 연결
            const child = childPositions[0];
            svg.append('path')
                .attr('class', 'link')
                .attr('d', `M ${parentX} ${parentY + parentOffset}
                           L ${parentX} ${midY}
                           L ${child.x} ${midY}
                           L ${child.x} ${child.y - child.offset}`)
                .style('stroke-width', '4')
                .style('cursor', 'pointer')
                .on('mouseenter', function() {
                    d3.select(this).style('stroke', '#4a5568').style('stroke-width', '5');
                })
                .on('mouseleave', function() {
                    d3.select(this).style('stroke', '#718096').style('stroke-width', '4');
                });
        } else {
            // 자식이 여러 명인 경우: T자 모양 연결
            const leftMost = Math.min(...childPositions.map(c => c.x));
            const rightMost = Math.max(...childPositions.map(c => c.x));

            // 부모에서 중간 지점까지 수직선
            svg.append('path')
                .attr('class', 'link')
                .attr('d', `M ${parentX} ${parentY + parentOffset} L ${parentX} ${midY}`)
                .style('stroke-width', '4')
                .style('cursor', 'pointer')
                .on('mouseenter', function() {
                    d3.select(this).style('stroke', '#4a5568').style('stroke-width', '5');
                })
                .on('mouseleave', function() {
                    d3.select(this).style('stroke', '#718096').style('stroke-width', '4');
                });

            // 자식들을 연결하는 수평선
            svg.append('path')
                .attr('class', 'link')
                .attr('d', `M ${leftMost} ${midY} L ${rightMost} ${midY}`)
                .style('stroke-width', '4')
                .style('cursor', 'pointer')
                .on('mouseenter', function() {
                    d3.select(this).style('stroke', '#4a5568').style('stroke-width', '5');
                })
                .on('mouseleave', function() {
                    d3.select(this).style('stroke', '#718096').style('stroke-width', '4');
                });

            // 각 자식으로 내려가는 수직선
            childPositions.forEach(child => {
                svg.append('path')
                    .attr('class', 'link')
                    .attr('d', `M ${child.x} ${midY} L ${child.x} ${child.y - child.offset}`)
                    .style('stroke-width', '4')
                    .style('cursor', 'pointer')
                    .on('mouseenter', function() {
                        d3.select(this).style('stroke', '#4a5568').style('stroke-width', '5');
                    })
                    .on('mouseleave', function() {
                        d3.select(this).style('stroke', '#718096').style('stroke-width', '4');
                    });
            });
        }
    }

    updatePersonCount() {
        this.elements.personCount.textContent = `팀원 수: ${this.people.length}`;
    }

    updateStatus(message) {
        this.elements.statusMessage.textContent = message;
        setTimeout(() => {
            this.elements.statusMessage.textContent = '시스템 준비 완료';
        }, 3000);
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 특별 구역 설정 메서드들
    setSpecialZone(zoneType) {
        if (this.selectedSeats.size === 0) {
            this.updateStatus('⚠️ 특별 구역을 설정할 좌석을 먼저 선택해주세요!');
            return;
        }

        // 선택된 좌석 중 팀이 할당된 좌석이 있는지 확인
        const teamAssignedSeats = Array.from(this.selectedSeats).filter(seatId => {
            const [row, col] = seatId.split('-').slice(1).map(Number);
            const seat = this.seatGrid[row][col];
            return seat.teamCard || seat.occupied;
        });

        if (teamAssignedSeats.length > 0) {
            const proceed = confirm(
                `선택된 좌석 중 ${teamAssignedSeats.length}개 좌석에 팀이 할당되어 있습니다.\n` +
                `특별 구역으로 설정하면 기존 팀 할당이 해제됩니다.\n` +
                `계속 진행하시겠습니까?`
            );
            if (!proceed) return;
        }

        // 기존 특별 구역 모드 해제
        this.specialZoneMode = null;
        
        // 선택된 좌석들을 특별 구역으로 설정
        this.selectedSeats.forEach(seatId => {
            this.specialZones.set(seatId, zoneType);
            this.updateSeatSpecialZone(seatId, zoneType);
        });

        const zoneName = zoneType === 'entrance' ? '입구' : '화장실';
        this.updateStatus(`✅ 선택된 ${this.selectedSeats.size}개 좌석을 ${zoneName} 구역으로 설정했습니다!`);
        
        // 선택 해제
        this.clearSeatSelection();
    }

    clearSpecialZones() {
        if (this.selectedSeats.size === 0) {
            // 선택된 좌석이 없으면 모든 특별 구역 해제
            this.specialZones.clear();
            this.updateStatus('🗑️ 모든 특별 구역을 해제했습니다!');
        } else {
            // 선택된 좌석들의 특별 구역만 해제
            this.selectedSeats.forEach(seatId => {
                this.specialZones.delete(seatId);
            });
            this.updateStatus(`🗑️ 선택된 ${this.selectedSeats.size}개 좌석의 특별 구역을 해제했습니다!`);
            this.clearSeatSelection();
        }
        
        // 좌석 그리드를 완전히 다시 생성하여 깔끔하게 정리
        this.updateSeatGrid();
    }

    updateSeatSpecialZone(seatId, zoneType) {
        let seatElement = document.querySelector(`[data-seat-id="${seatId}"]`);
        if (!seatElement) {
            // data-seat-id로 찾지 못하면 data-id로도 시도
            seatElement = document.querySelector(`[data-id="${seatId}"]`);
            if (!seatElement) {
                return;
            }
        }

        // 기존 특별 구역 클래스 제거
        seatElement.classList.remove('special-entrance', 'special-restroom');
        
        // 새로운 특별 구역 클래스 추가
        if (zoneType) {
            seatElement.classList.add(`special-${zoneType}`);
            
            // 특별 구역 라벨 업데이트
            const labelElement = seatElement.querySelector('.seat-label');
            if (labelElement) {
                const zoneLabel = zoneType === 'entrance' ? '🚪 입구' : '🚽 화장실';
                labelElement.textContent = zoneLabel;
            }
            
            // 기존 팀원 정보 제거
            const personElement = seatElement.querySelector('.seat-person');
            if (personElement) {
                personElement.remove();
            }
            
            // 좌석 데이터에서도 팀원 정보 제거
            const seat = this.findSeatById(seatId);
            if (seat) {
                seat.person = null;
                seat.occupied = false;
                seat.teamCard = null;
            }
        } else {
            // 특별 구역 해제 시에는 updateSeatGrid()에서 처리하므로 여기서는 아무것도 하지 않음
            // 좌석 그리드가 다시 생성되면서 자동으로 올바른 상태로 복원됨
        }
    }

    findSeatById(seatId) {
        for (let row of this.seatGrid) {
            for (let seat of row) {
                if (seat.id === seatId) {
                    return seat;
                }
            }
        }
        return null;
    }






}

// 시스템 초기화
let orgChart;
document.addEventListener('DOMContentLoaded', () => {
    orgChart = new OrgChartSystem();
});

// 창 크기 변경 시 차트 재조정
window.addEventListener('resize', () => {
    if (orgChart) {
        const chartContainer = orgChart.elements.orgChart;
        const width = chartContainer.clientWidth;
        const height = 700; // 고정 높이
        
        orgChart.svg.attr('width', width).attr('height', height);
        // nodeSize를 사용하므로 size 재설정이 불필요
        orgChart.updateChart();
    }
}); 