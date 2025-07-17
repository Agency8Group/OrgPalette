class OrgChartSystem {
    constructor() {
        this.people = [];
        this.svg = null;
        this.treeLayout = null;
        this.zoom = null;
        this.currentTransform = d3.zoomIdentity;
        this.teamColors = new Map(); // 팀별 색상 캐시
        this.usedColors = new Set(); // 사용된 색상 추적
        
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
        
        // 자동 저장 데이터 확인 후 로드
        this.initializeData();
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
            excelUpload: document.getElementById('excel-upload'),
            sampleDataBtn: document.getElementById('sample-data-btn'),
            inputRows: document.getElementById('input-rows'),
            addAllBtn: document.getElementById('add-all-btn'),
            clearInputsBtn: document.getElementById('clear-inputs-btn'),
            clearAllBtn: document.getElementById('clear-all-btn'),
            exportExcelBtn: document.getElementById('export-excel-btn'),
            exportPdfBtn: document.getElementById('export-pdf-btn'),
            exportPdfHqBtn: document.getElementById('export-pdf-hq-btn'),
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
            confirmNo: document.getElementById('confirm-no')
        };
        
        // 입력 행 카운터
        this.rowCounter = 1;
    }

    setupEventListeners() {
        this.elements.excelUpload.addEventListener('change', (e) => this.handleExcelUpload(e));
        this.elements.sampleDataBtn.addEventListener('click', () => this.loadSampleData());
        this.elements.addAllBtn.addEventListener('click', () => this.addAllPeople());
        this.elements.clearInputsBtn.addEventListener('click', () => this.clearInputs());
        this.elements.clearAllBtn.addEventListener('click', () => this.clearAll());
        this.elements.exportExcelBtn.addEventListener('click', () => this.exportToExcel());
        this.elements.exportPdfBtn.addEventListener('click', () => this.exportToPDF(false));
        this.elements.exportPdfHqBtn.addEventListener('click', () => this.exportToPDF(true));
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

        // 동적 입력 행 이벤트 (이벤트 위임)
        this.elements.inputRows.addEventListener('click', (e) => this.handleRowButtonClick(e));
        this.elements.inputRows.addEventListener('keypress', (e) => this.handleRowKeyPress(e));
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

        // 트리 레이아웃 설정 - 고정된 노드 간격 사용
        this.treeLayout = d3.tree()
            .nodeSize([160, 140]) // 고정된 노드 크기 사용 (width, height)
            .separation((a, b) => {
                // 고정된 간격 값 사용
                if (a.data.type === 'team' || b.data.type === 'team') {
                    return a.parent === b.parent ? 1.0 : 2.5;
                }
                return a.parent === b.parent ? 1.5 : 2.0;
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
            { id: '8', name: '지윤환', position: '수습', task: '전략기획, 시스템', department: '전략기획실', manager: '강병현' },
            
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
            { id: '61', name: '신선경', position: '사원', task: '압타밀 마케팅(재택)', department: '브랜드사업부(M)', manager: '김은정' },
            
            // 백화점판매팀
            { id: '62', name: '김옥금', position: '매니저', task: '드리미 백화점', department: '백화점판매팀', manager: '강병훈' },
            { id: '63', name: '백현주', position: '매니저', task: '드리미 백화점', department: '백화점판매팀', manager: '강병훈' },
            { id: '64', name: '이남정', position: '시니어(주4)', task: '드리미 백화점', department: '백화점판매팀', manager: '김옥금' },
            { id: '65', name: '유락희', position: '시니어(주4)', task: '드리미 백화점', department: '백화점판매팀', manager: '백현주' },
            { id: '66', name: '손연하', position: '매니저', task: '드리미 백화점', department: '백화점판매팀', manager: '강병훈' },
            { id: '67', name: '이명희', position: '매니저', task: '드리미 백화점', department: '백화점판매팀', manager: '강병훈' },
            { id: '68', name: '이정아', position: '매니저', task: '드리미 백화점', department: '백화점판매팀', manager: '강병훈' },
            { id: '69', name: '장재원', position: '시니어(주4)', task: '드리미 백화점', department: '백화점판매팀', manager: '이명희' },
            { id: '70', name: '염미경', position: '매니저', task: '드리미 백화점', department: '백화점판매팀', manager: '강병훈' },
            { id: '71', name: '배여진', position: '시니어(주4)', task: '드리미 백화점', department: '백화점판매팀', manager: '염미경' },
            { id: '72', name: '박지우', position: '매니저', task: '드리미 백화점', department: '백화점판매팀', manager: '강병훈' },
            { id: '73', name: '김희정', position: '시니어(주4)', task: '드리미 백화점', department: '백화점판매팀', manager: '박지우' },
            { id: '74', name: '정원화', position: '시니어(주4)', task: '드리미 백화점', department: '백화점판매팀', manager: '강병훈' },
            { id: '75', name: '김경미', position: '시니어(주4)', task: '드리미 백화점', department: '백화점판매팀', manager: '강병훈' },
            { id: '76', name: '신형묵', position: '매니저', task: '드리미 백화점', department: '백화점판매팀', manager: '강병훈' },
            { id: '77', name: '이민선', position: '매니저', task: '드리미 백화점', department: '백화점판매팀', manager: '강병훈' },
            { id: '78', name: '노숙경', position: '시니어(주5)', task: '드리미 백화점', department: '백화점판매팀', manager: '이민선' },
            { id: '79', name: '박소현', position: '매니저', task: '드리미 백화점', department: '백화점판매팀', manager: '강병훈' },
            { id: '80', name: '강효순', position: '시니어(주4)', task: '드리미 백화점', department: '백화점판매팀', manager: '박소현' },
            { id: '81', name: '안미경', position: '시니어(주4)', task: '드리미 백화점', department: '백화점판매팀', manager: '강병훈' }
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

        const qualityText = isHighQuality ? '고화질' : '표준';
        this.updateStatus(`${qualityText} PDF 파일을 생성하고 있습니다...`);

        try {
            // 현재 줌 상태 저장
            const currentTransform = this.currentTransform;
            
            // 전체 조직도가 보이도록 리셋
            this.centerChart();
            
            // 잠시 대기 (애니메이션 완료)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 화질 설정
            const qualitySettings = isHighQuality ? {
                scale: 6, // 6배 확대 (고화질)
                dpi: 300,
                format: 'a3' // A3 크기로 더 큰 공간 제공
            } : {
                scale: 2, // 2배 확대 (표준)
                dpi: 150,
                format: 'a4'
            };

            // 조직도 캔버스로 변환
            const chartElement = this.elements.orgChart;
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
                pixelRatio: 1
            });

            // PDF 생성
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: qualitySettings.format
            });

            // 이미지 추가
            const imgData = canvas.toDataURL('image/png', 1.0); // 최고 품질 PNG
            const pageWidth = qualitySettings.format === 'a3' ? 420 : 297; // A3: 420mm, A4: 297mm
            const pageHeight = qualitySettings.format === 'a3' ? 297 : 210; // A3: 297mm, A4: 210mm
            
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            let heightLeft = imgHeight;
            let position = 0;

            // 첫 페이지
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // 필요시 추가 페이지
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // 파일 저장
            const qualityPrefix = isHighQuality ? '_HQ' : '';
            const fileName = `orgchart${qualityPrefix}_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);

            // 원래 줌 상태 복원
            this.svg.call(this.zoom.transform, currentTransform);

            this.updateStatus(`${qualityText} PDF 파일이 다운로드되었습니다!`);

        } catch (error) {
            console.error('PDF 생성 오류:', error);
            this.updateStatus(`${qualityText} PDF 생성 중 오류가 발생했습니다.`);
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

        // 팀 노드 (사각형)
        nodes.filter(d => d.data.type === 'team')
            .append('rect')
            .attr('x', -60)
            .attr('y', -25)
            .attr('width', 120)
            .attr('height', 50)
            .attr('rx', 15)
            .style('fill', d => d.data.teamColor || this.getTeamColor(d.data.department))
            .style('stroke', d => {
                const teamColor = d.data.teamColor || this.getTeamColor(d.data.department);
                return this.getTeamStrokeColorFromBase(teamColor);
            })
            .style('stroke-width', 3);

        // 개인 노드 (원형) - CEO는 더 크게
        nodes.filter(d => d.data.type === 'person')
            .append('circle')
            .attr('r', d => this.isCEO(d.data) ? 55 : 40)
            .style('fill', d => this.getPersonColor(d.data))
            .style('stroke', d => this.getPersonStrokeColor(d.data))
            .style('stroke-width', d => this.isCEO(d.data) ? 3 : 2);

        // 팀명 텍스트
        nodes.filter(d => d.data.type === 'team')
            .append('text')
            .attr('dy', '0.3em')
            .style('text-anchor', 'middle')
            .style('dominant-baseline', 'middle')
            .style('font-size', '16px')
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
                    '1px 1px 2px rgba(255,255,255,0.8)' : 
                    '1px 1px 2px rgba(0,0,0,0.8)';
            })
            .text(d => d.data.name);

        // CEO 왕관 텍스트 (맨 위) - 5px 아래로
        nodes.filter(d => d.data.type === 'person' && this.isCEO(d.data))
            .append('text')
            .attr('dy', '-1.8em')
            .style('text-anchor', 'middle')
            .style('font-size', '20px')
            .style('fill', '#ffd700')
            .style('text-shadow', '2px 2px 4px rgba(0,0,0,0.5)')
            .text('👑');

        // 개인 이름 텍스트 - CEO는 더 크게
        nodes.filter(d => d.data.type === 'person')
            .append('text')
            .attr('dy', d => this.isCEO(d.data) ? '-0.8em' : '-1.5em')
            .style('text-anchor', 'middle')
            .style('dominant-baseline', 'middle')
            .style('font-size', d => this.isCEO(d.data) ? '16px' : '12px')
            .style('fill', 'white')
            .style('font-weight', 'bold')
            .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
            .text(d => d.data.name);

        // 개인 직급 텍스트 - CEO는 더 크게 (CEO는 임무가 없으므로 중앙에 위치)
        nodes.filter(d => d.data.type === 'person')
            .append('text')
            .attr('dy', d => this.isCEO(d.data) ? '1.2em' : '-0.2em')
            .style('text-anchor', 'middle')
            .style('dominant-baseline', 'middle')
            .style('font-size', d => this.isCEO(d.data) ? '14px' : '10px')
            .style('fill', '#e2e8f0')
            .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
            .text(d => d.data.position);

        // 개인 임무 텍스트 - CEO는 표시 안함
        nodes.filter(d => d.data.type === 'person' && !this.isCEO(d.data))
            .append('text')
            .attr('dy', '1.8em')
            .style('text-anchor', 'middle')
            .style('dominant-baseline', 'middle')
            .style('font-size', '9px')
            .style('fill', '#90cdf4')
            .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
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
        
        // 부모 노드의 연결점 계산
        const parentOffset = parentNode.data.type === 'team' ? 25 : 35; // 팀 노드는 사각형이므로 25, 개인 노드는 원형이므로 35
        
        // 자식 노드들의 위치 정보
        const childPositions = children.map(child => ({
            x: child.x,
            y: child.y,
            offset: child.data.type === 'team' ? 25 : 35 // 각 자식의 타입에 따른 오프셋
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
                .style('cursor', 'pointer')
                .on('mouseenter', function() {
                    d3.select(this).style('stroke', '#4a5568').style('stroke-width', '3');
                })
                .on('mouseleave', function() {
                    d3.select(this).style('stroke', '#718096').style('stroke-width', '2');
                });
        } else {
            // 자식이 여러 명인 경우: T자 모양 연결
            const leftMost = Math.min(...childPositions.map(c => c.x));
            const rightMost = Math.max(...childPositions.map(c => c.x));

            // 부모에서 중간 지점까지 수직선
            svg.append('path')
                .attr('class', 'link')
                .attr('d', `M ${parentX} ${parentY + parentOffset} L ${parentX} ${midY}`)
                .style('cursor', 'pointer')
                .on('mouseenter', function() {
                    d3.select(this).style('stroke', '#4a5568').style('stroke-width', '3');
                })
                .on('mouseleave', function() {
                    d3.select(this).style('stroke', '#718096').style('stroke-width', '2');
                });

            // 자식들을 연결하는 수평선
            svg.append('path')
                .attr('class', 'link')
                .attr('d', `M ${leftMost} ${midY} L ${rightMost} ${midY}`)
                .style('cursor', 'pointer')
                .on('mouseenter', function() {
                    d3.select(this).style('stroke', '#4a5568').style('stroke-width', '3');
                })
                .on('mouseleave', function() {
                    d3.select(this).style('stroke', '#718096').style('stroke-width', '2');
                });

            // 각 자식으로 내려가는 수직선
            childPositions.forEach(child => {
                svg.append('path')
                    .attr('class', 'link')
                    .attr('d', `M ${child.x} ${midY} L ${child.x} ${child.y - child.offset}`)
                    .style('cursor', 'pointer')
                    .on('mouseenter', function() {
                        d3.select(this).style('stroke', '#4a5568').style('stroke-width', '3');
                    })
                    .on('mouseleave', function() {
                        d3.select(this).style('stroke', '#718096').style('stroke-width', '2');
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